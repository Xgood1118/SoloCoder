package alert

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log-pipeline/internal/config"
	"log-pipeline/internal/models"
	"log-pipeline/internal/store"
	"log-pipeline/pkg/utils"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"gopkg.in/gomail.v2"
)

type ConditionEvaluator interface {
	Evaluate(rule *models.AlertRule, value float64) (bool, string)
}

type ThresholdEvaluator struct{}

func (e *ThresholdEvaluator) Evaluate(rule *models.AlertRule, value float64) (bool, string) {
	expr := rule.Expression
	var triggered bool
	var operator string

	switch {
	case strings.Contains(expr, ">="):
		operator = ">="
		triggered = value >= rule.Threshold
	case strings.Contains(expr, "<="):
		operator = "<="
		triggered = value <= rule.Threshold
	case strings.Contains(expr, ">"):
		operator = ">"
		triggered = value > rule.Threshold
	case strings.Contains(expr, "<"):
		operator = "<"
		triggered = value < rule.Threshold
	case strings.Contains(expr, "=="):
		operator = "=="
		triggered = value == rule.Threshold
	case strings.Contains(expr, "!="):
		operator = "!="
		triggered = value != rule.Threshold
	default:
		operator = ">"
		triggered = value > rule.Threshold
	}

	message := fmt.Sprintf("Alert '%s' triggered: current value %.2f %s threshold %.2f",
		rule.Name, value, operator, rule.Threshold)

	return triggered, message
}

type Notifier interface {
	Notify(rule *models.AlertRule, history *models.AlertHistory) error
	Type() string
}

type EmailNotifier struct {
	dialer *gomail.Dialer
	from   string
}

func NewEmailNotifier(cfg config.AlertConfig) *EmailNotifier {
	dialer := gomail.NewDialer(
		cfg.EmailSMTPHost,
		cfg.EmailSMTPPort,
		cfg.EmailUsername,
		cfg.EmailPassword,
	)
	return &EmailNotifier{
		dialer: dialer,
		from:   cfg.EmailFrom,
	}
}

func (n *EmailNotifier) Notify(rule *models.AlertRule, history *models.AlertHistory) error {
	var actions []models.AlertAction
	if err := utils.FromJSON(rule.Actions, &actions); err != nil {
		return err
	}

	for _, action := range actions {
		if action.Type != "email" {
			continue
		}

		to, ok := action.Config["to"].(string)
		if !ok {
			continue
		}

		m := gomail.NewMessage()
		m.SetHeader("From", n.from)
		m.SetHeader("To", to)
		m.SetHeader("Subject", fmt.Sprintf("[%s] %s", strings.ToUpper(string(rule.Severity)), rule.Name))

		body := fmt.Sprintf(`
Alert Triggered:
Rule: %s
Severity: %s
Message: %s
Triggered At: %s
Current Value: %.2f
Threshold: %.2f

Rule ID: %s
`, rule.Name, rule.Severity, history.Message,
			history.TriggeredAt.Format(time.RFC3339),
			history.Value, history.Threshold,
			rule.ID)

		m.SetBody("text/plain", body)

		if err := n.dialer.DialAndSend(m); err != nil {
			utils.Sugar.Errorf("Failed to send email alert: %v", err)
			return err
		}

		utils.Sugar.Infof("Email alert sent to %s for rule %s", to, rule.ID)
	}

	return nil
}

func (n *EmailNotifier) Type() string {
	return "email"
}

type WebhookNotifier struct {
	client *http.Client
}

func NewWebhookNotifier() *WebhookNotifier {
	return &WebhookNotifier{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (n *WebhookNotifier) Notify(rule *models.AlertRule, history *models.AlertHistory) error {
	var actions []models.AlertAction
	if err := utils.FromJSON(rule.Actions, &actions); err != nil {
		return err
	}

	for _, action := range actions {
		if action.Type != "webhook" {
			continue
		}

		url, ok := action.Config["url"].(string)
		if !ok {
			continue
		}

		payload := map[string]interface{}{
			"rule_id":      rule.ID,
			"rule_name":    rule.Name,
			"severity":     rule.Severity,
			"message":      history.Message,
			"value":        history.Value,
			"threshold":    history.Threshold,
			"triggered_at": history.TriggeredAt,
		}

		body, err := json.Marshal(payload)
		if err != nil {
			return err
		}

		req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		if apiKey, ok := action.Config["api_key"].(string); ok {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}

		resp, err := n.client.Do(req)
		if err != nil {
			utils.Sugar.Errorf("Failed to send webhook alert: %v", err)
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			utils.Sugar.Errorf("Webhook returned status %d", resp.StatusCode)
			return fmt.Errorf("webhook failed with status %d", resp.StatusCode)
		}

		utils.Sugar.Infof("Webhook alert sent to %s for rule %s", url, rule.ID)
	}

	return nil
}

func (n *WebhookNotifier) Type() string {
	return "webhook"
}

type RuleState struct {
	rule        *models.AlertRule
	triggered   bool
	lastValue   float64
	lastCheck   time.Time
	cooldownEnd time.Time
}

type AggregationValueProvider interface {
	GetCurrentValue(ruleID string, window string) float64
}

type Engine struct {
	store               *store.AlertRuleStore
	aggregationEngine   AggregationValueProvider
	evaluator       ConditionEvaluator
	notifiers       []Notifier
	rules           map[string]*RuleState
	mu              sync.RWMutex
	cancel          context.CancelFunc
	checkInterval   time.Duration
	cooldownPeriod  time.Duration
}

func NewEngine(aggregationEngine AggregationValueProvider) *Engine {
	return &Engine{
		store:             store.NewAlertRuleStore(),
		aggregationEngine: aggregationEngine,
		evaluator:       &ThresholdEvaluator{},
		notifiers:       make([]Notifier, 0),
		rules:           make(map[string]*RuleState),
		checkInterval:   config.AppConfig.Alert.CheckInterval,
		cooldownPeriod:  5 * time.Minute,
	}
}

func (e *Engine) Start(ctx context.Context) error {
	ctx, e.cancel = context.WithCancel(ctx)

	e.notifiers = append(e.notifiers, NewEmailNotifier(config.AppConfig.Alert))
	e.notifiers = append(e.notifiers, NewWebhookNotifier())

	if err := e.loadRules(); err != nil {
		return fmt.Errorf("load rules: %w", err)
	}

	go e.checkLoop(ctx)

	utils.Sugar.Info("Alert engine started")
	return nil
}

func (e *Engine) Stop() {
	if e.cancel != nil {
		e.cancel()
	}
	utils.Sugar.Info("Alert engine stopped")
}

func (e *Engine) loadRules() error {
	rules, err := e.store.ListActive()
	if err != nil {
		return err
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	for i := range rules {
		e.rules[rules[i].ID] = &RuleState{
			rule:      &rules[i],
			triggered: false,
		}
	}

	return nil
}

func (e *Engine) checkLoop(ctx context.Context) {
	ticker := time.NewTicker(e.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.checkAllRules()
		}
	}
}

func (e *Engine) checkAllRules() {
	e.mu.RLock()
	rules := make([]*RuleState, 0, len(e.rules))
	for _, rs := range e.rules {
		rules = append(rules, rs)
	}
	e.mu.RUnlock()

	for _, rs := range rules {
		e.checkRule(rs)
	}
}

func (e *Engine) checkRule(rs *RuleState) {
	if rs.rule.Status != models.AlertStatusActive {
		return
	}

	if time.Now().Before(rs.cooldownEnd) {
		return
	}

	aggID := e.getAggregationRuleID(rs.rule)
	value := e.aggregationEngine.GetCurrentValue(aggID, rs.rule.Window)

	rs.lastValue = value
	rs.lastCheck = time.Now()

	triggered, message := e.evaluator.Evaluate(rs.rule, value)

	if triggered && !rs.triggered {
		e.triggerAlert(rs, value, message)
	} else if !triggered && rs.triggered {
		e.resolveAlert(rs)
	}
}

func (e *Engine) getAggregationRuleID(rule *models.AlertRule) string {
	return rule.PipelineID
}

func (e *Engine) triggerAlert(rs *RuleState, value float64, message string) {
	rs.triggered = true
	rs.cooldownEnd = time.Now().Add(e.cooldownPeriod)

	history := &models.AlertHistory{
		RuleID:      rs.rule.ID,
		RuleName:    rs.rule.Name,
		Severity:    rs.rule.Severity,
		Message:     message,
		Value:       value,
		Threshold:   rs.rule.Threshold,
		TriggeredAt: time.Now(),
		Resolved:    false,
	}

	if err := e.store.CreateHistory(history); err != nil {
		utils.Sugar.Errorf("Failed to create alert history: %v", err)
	}

	for _, notifier := range e.notifiers {
		if err := notifier.Notify(rs.rule, history); err != nil {
			utils.Sugar.Errorf("Notifier %s error: %v", notifier.Type(), err)
		}
	}

	utils.Sugar.Warnf("Alert triggered: %s, value=%.2f, threshold=%.2f",
		rs.rule.Name, value, rs.rule.Threshold)
}

func (e *Engine) resolveAlert(rs *RuleState) {
	rs.triggered = false

	now := time.Now()
	err := utils.DB.Model(&models.AlertHistory{}).
		Where("rule_id = ? AND resolved = ?", rs.rule.ID, false).
		Updates(map[string]interface{}{
			"resolved":     true,
			"resolved_at":  now,
		}).Error

	if err != nil {
		utils.Sugar.Errorf("Failed to resolve alert: %v", err)
	}

	utils.Sugar.Infof("Alert resolved: %s", rs.rule.Name)
}

func (e *Engine) AddRule(rule *models.AlertRule) error {
	if err := e.store.Create(rule); err != nil {
		return err
	}

	e.mu.Lock()
	e.rules[rule.ID] = &RuleState{
		rule:      rule,
		triggered: false,
	}
	e.mu.Unlock()

	utils.Sugar.Infof("Alert rule added: %s", rule.Name)
	return nil
}

func (e *Engine) UpdateRule(rule *models.AlertRule) error {
	if err := e.store.Update(rule); err != nil {
		return err
	}

	e.mu.Lock()
	if rs, exists := e.rules[rule.ID]; exists {
		rs.rule = rule
		rs.triggered = false
		rs.cooldownEnd = time.Time{}
	} else {
		e.rules[rule.ID] = &RuleState{
			rule:      rule,
			triggered: false,
		}
	}
	e.mu.Unlock()

	utils.Sugar.Infof("Alert rule updated: %s", rule.Name)
	return nil
}

func (e *Engine) DeleteRule(id string) error {
	if err := e.store.Delete(id); err != nil {
		return err
	}

	e.mu.Lock()
	delete(e.rules, id)
	e.mu.Unlock()

	utils.Sugar.Infof("Alert rule deleted: %s", id)
	return nil
}

func (e *Engine) UpdateRuleStatus(id string, status models.AlertStatus) error {
	if err := e.store.UpdateStatus(id, status); err != nil {
		return err
	}

	e.mu.Lock()
	if rs, exists := e.rules[id]; exists {
		rs.rule.Status = status
		if status == models.AlertStatusInactive {
			rs.triggered = false
		}
	}
	e.mu.Unlock()

	return nil
}

func (e *Engine) ListRules() ([]models.AlertRule, error) {
	return e.store.List()
}

func (e *Engine) GetRule(id string) (*models.AlertRule, error) {
	return e.store.GetByID(id)
}

func (e *Engine) ListHistory(ruleID string, limit int) ([]models.AlertHistory, error) {
	return e.store.ListHistory(ruleID, limit)
}

func (e *Engine) ParseExpression(expr string) (string, float64, error) {
	expr = strings.TrimSpace(expr)

	operators := []string{">=", "<=", "==", "!=", ">", "<"}
	for _, op := range operators {
		if strings.Contains(expr, op) {
			parts := strings.SplitN(expr, op, 2)
			if len(parts) == 2 {
				threshold, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
				if err != nil {
					return "", 0, err
				}
				return op, threshold, nil
			}
		}
	}

	return "", 0, fmt.Errorf("invalid expression format")
}
