package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type AlertLevel string

const (
	AlertLevelInfo     AlertLevel = "info"
	AlertLevelWarning  AlertLevel = "warning"
	AlertLevelError    AlertLevel = "error"
	AlertLevelCritical AlertLevel = "critical"
)

type Alert struct {
	Level     AlertLevel `json:"level"`
	Title     string     `json:"title"`
	Content   string     `json:"content"`
	JobID     string     `json:"job_id,omitempty"`
	Timestamp time.Time  `json:"timestamp"`
}

type Notifier interface {
	Notify(ctx context.Context, alert *Alert) error
}

type WebhookNotifier struct {
	url    string
	client *http.Client
}

func NewWebhookNotifier(url string) *WebhookNotifier {
	return &WebhookNotifier{
		url: url,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (n *WebhookNotifier) Notify(ctx context.Context, alert *Alert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("marshal alert failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("send webhook failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}

type EmailNotifier struct {
	smtpHost string
	smtpPort int
	username string
	password string
	from     string
	to       []string
}

func NewEmailNotifier(smtpHost string, smtpPort int, username, password, from string, to []string) *EmailNotifier {
	return &EmailNotifier{
		smtpHost: smtpHost,
		smtpPort: smtpPort,
		username: username,
		password: password,
		from:     from,
		to:       to,
	}
}

func (n *EmailNotifier) Notify(ctx context.Context, alert *Alert) error {
	subject := fmt.Sprintf("[%s] %s", alert.Level, alert.Title)
	body := fmt.Sprintf("任务ID: %s\n时间: %s\n\n%s", alert.JobID, alert.Timestamp.Format(time.RFC3339), alert.Content)
	_ = subject
	_ = body
	return nil
}

type ConsoleNotifier struct {
}

func NewConsoleNotifier() *ConsoleNotifier {
	return &ConsoleNotifier{}
}

func (n *ConsoleNotifier) Notify(ctx context.Context, alert *Alert) error {
	fmt.Printf("[%s] %s - %s\nJobID: %s\nTime: %s\n%s\n\n",
		alert.Level,
		alert.Title,
		alert.Content,
		alert.JobID,
		alert.Timestamp.Format(time.RFC3339),
		alert.Content,
	)
	return nil
}

type alertDedupeKey struct {
	level   AlertLevel
	title   string
	jobID   string
	content string
}

type AlertManager struct {
	mu            sync.RWMutex
	notifiers     map[string]Notifier
	levelFilter   AlertLevel
	dedupeWindow  time.Duration
	recentAlerts  map[alertDedupeKey]time.Time
}

func NewAlertManager() *AlertManager {
	return &AlertManager{
		notifiers:    make(map[string]Notifier),
		levelFilter:  AlertLevelInfo,
		dedupeWindow: 5 * time.Minute,
		recentAlerts: make(map[alertDedupeKey]time.Time),
	}
}

func (m *AlertManager) AddNotifier(name string, notifier Notifier) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.notifiers[name] = notifier
}

func (m *AlertManager) RemoveNotifier(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.notifiers, name)
}

func (m *AlertManager) SetLevelFilter(level AlertLevel) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.levelFilter = level
}

func (m *AlertManager) SetDedupeWindow(window time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.dedupeWindow = window
}

func (m *AlertManager) levelEnabled(level AlertLevel) bool {
	levels := []AlertLevel{AlertLevelInfo, AlertLevelWarning, AlertLevelError, AlertLevelCritical}
	filterIndex := -1
	alertIndex := -1

	for i, l := range levels {
		if l == m.levelFilter {
			filterIndex = i
		}
		if l == level {
			alertIndex = i
		}
	}

	if filterIndex == -1 || alertIndex == -1 {
		return true
	}

	return alertIndex >= filterIndex
}

func (m *AlertManager) isDuplicate(alert *Alert) bool {
	key := alertDedupeKey{
		level:   alert.Level,
		title:   alert.Title,
		jobID:   alert.JobID,
		content: alert.Content,
	}

	now := time.Now()

	if lastTime, exists := m.recentAlerts[key]; exists {
		if now.Sub(lastTime) < m.dedupeWindow {
			return true
		}
	}

	m.recentAlerts[key] = now

	for k, t := range m.recentAlerts {
		if now.Sub(t) > m.dedupeWindow {
			delete(m.recentAlerts, k)
		}
	}

	return false
}

func (m *AlertManager) Notify(ctx context.Context, alert *Alert) error {
	if alert == nil {
		return fmt.Errorf("alert is nil")
	}

	if alert.Timestamp.IsZero() {
		alert.Timestamp = time.Now()
	}

	m.mu.RLock()
	levelFilter := m.levelFilter
	notifiers := make(map[string]Notifier, len(m.notifiers))
	for k, v := range m.notifiers {
		notifiers[k] = v
	}
	m.mu.RUnlock()

	m.levelFilter = levelFilter
	if !m.levelEnabled(alert.Level) {
		return nil
	}

	m.mu.Lock()
	isDup := m.isDuplicate(alert)
	m.mu.Unlock()

	if isDup {
		return nil
	}

	var firstErr error
	for name, notifier := range notifiers {
		if err := notifier.Notify(ctx, alert); err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("notifier %s failed: %w", name, err)
			}
		}
	}

	return firstErr
}

func (m *AlertManager) NotifyInfo(ctx context.Context, title, content, jobID string) error {
	return m.Notify(ctx, &Alert{
		Level:   AlertLevelInfo,
		Title:   title,
		Content: content,
		JobID:   jobID,
	})
}

func (m *AlertManager) NotifyWarning(ctx context.Context, title, content, jobID string) error {
	return m.Notify(ctx, &Alert{
		Level:   AlertLevelWarning,
		Title:   title,
		Content: content,
		JobID:   jobID,
	})
}

func (m *AlertManager) NotifyError(ctx context.Context, title, content, jobID string) error {
	return m.Notify(ctx, &Alert{
		Level:   AlertLevelError,
		Title:   title,
		Content: content,
		JobID:   jobID,
	})
}

func (m *AlertManager) NotifyCritical(ctx context.Context, title, content, jobID string) error {
	return m.Notify(ctx, &Alert{
		Level:   AlertLevelCritical,
		Title:   title,
		Content: content,
		JobID:   jobID,
	})
}
