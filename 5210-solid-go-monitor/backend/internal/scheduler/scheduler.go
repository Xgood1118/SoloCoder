package scheduler

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"solid-go-monitor/internal/model"
	"solid-go-monitor/internal/probe"
	"solid-go-monitor/internal/store"
)

type Scheduler struct {
	store       *store.Store
	tickers     sync.Map
	eventCh     chan *model.Event
	workerCount int
	stopCh      chan struct{}
}

func NewScheduler(s *store.Store) *Scheduler {
	return &Scheduler{
		store:       s,
		eventCh:     make(chan *model.Event, 1000),
		workerCount: 5,
		stopCh:      make(chan struct{}),
	}
}

func (sc *Scheduler) Start() {
	go sc.eventWorker()
	go sc.escalationChecker()
}

func (sc *Scheduler) Stop() {
	close(sc.stopCh)
	sc.tickers.Range(func(key, value interface{}) bool {
		value.(*time.Ticker).Stop()
		return true
	})
}

func (sc *Scheduler) StartProbe(probeID string) {
	p, ok := sc.store.GetProbe(probeID)
	if !ok || !p.Enabled {
		return
	}

	if _, ok := sc.tickers.Load(probeID); ok {
		return
	}

	ticker := time.NewTicker(time.Duration(p.Interval) * time.Second)
	sc.tickers.Store(probeID, ticker)

	go func() {
		for range ticker.C {
			sc.checkProbe(probeID)
		}
	}()

	go sc.checkProbe(probeID)
}

func (sc *Scheduler) StopProbe(probeID string) {
	if ticker, ok := sc.tickers.LoadAndDelete(probeID); ok {
		ticker.(*time.Ticker).Stop()
	}
}

func (sc *Scheduler) RestartProbe(probeID string) {
	sc.StopProbe(probeID)
	sc.StartProbe(probeID)
}

func (sc *Scheduler) checkProbe(probeID string) {
	p, ok := sc.store.GetProbe(probeID)
	if !ok {
		return
	}

	var result *model.ProbeResult
	var errMsg string

	switch p.Type {
	case model.ProbeTypeHTTP:
		result, errMsg = probe.CheckHTTP(p.Target, p.Timeout)
	case model.ProbeTypeTCP:
		result, errMsg = probe.CheckTCP(p.Target, p.Timeout)
	case model.ProbeTypeProcess:
		result, errMsg = probe.CheckProcess(p.Target, p.Timeout)
	default:
		result = model.NewProbeResult(probeID, model.ProbeStatusUnknown, 0, "unknown probe type")
	}

	newResult := model.NewProbeResult(probeID, result.Status, result.ResponseTime, result.ErrorMessage)
	newResult.HTTPStatus = result.HTTPStatus
	newResult.CPUPercent = result.CPUPercent
	newResult.MemoryPercent = result.MemoryPercent

	sc.store.AddResult(probeID, newResult)

	prevStatus := sc.store.GetStatus(probeID)
	currStatus := newResult.Status

	if prevStatus != currStatus {
		sc.store.SetStatus(probeID, currStatus)

		event := model.NewEvent(probeID, p.Name, prevStatus, currStatus, errMsg)
		sc.eventCh <- event
	}

	failCount := sc.store.GetFailCount(probeID)
	if currStatus == model.ProbeStatusDown {
		failCount++
		sc.store.SetFailCount(probeID, failCount)

		if failCount >= p.FailureThreshold {
			sc.triggerAlert(p, errMsg)
		}
	} else {
		if failCount >= p.FailureThreshold {
			sc.resolveAlert(probeID)
		}
		sc.store.SetFailCount(probeID, 0)
	}
}

func (sc *Scheduler) TestProbe(probeID string) *model.ProbeResult {
	p, ok := sc.store.GetProbe(probeID)
	if !ok {
		return nil
	}

	var result *model.ProbeResult

	switch p.Type {
	case model.ProbeTypeHTTP:
		result, _ = probe.CheckHTTP(p.Target, p.Timeout)
	case model.ProbeTypeTCP:
		result, _ = probe.CheckTCP(p.Target, p.Timeout)
	case model.ProbeTypeProcess:
		result, _ = probe.CheckProcess(p.Target, p.Timeout)
	}

	if result != nil {
		result.ProbeID = probeID
	}
	return result
}

func (sc *Scheduler) triggerAlert(p *model.Probe, message string) {
	if existing, ok := sc.store.GetAlert(p.ID); ok {
		existing.Message = message
		return
	}

	alert := model.NewAlert(p, message)
	sc.store.AddAlert(alert)

	sc.sendWebhook(p, alert)
}

func (sc *Scheduler) resolveAlert(probeID string) {
	sc.store.ResolveAlert(probeID)
}

func (sc *Scheduler) eventWorker() {
	for {
		select {
		case event := <-sc.eventCh:
			sc.store.AddEvent(event)
		case <-sc.stopCh:
			return
		}
	}
}

func (sc *Scheduler) sendWebhook(p *model.Probe, alert *model.Alert) {
	if p.WebhookURL == "" {
		return
	}

	if alert.Silenced && time.Now().Before(alert.SilencedUntil) {
		return
	}

	payload := model.WebhookPayload{
		ProbeID:   p.ID,
		ProbeName: p.Name,
		Status:    string(alert.Status),
		Message:   alert.Message,
		Timestamp: time.Now(),
		Level:     string(alert.Level),
	}

	go func(url string, payload model.WebhookPayload) {
		data, err := json.Marshal(payload)
		if err != nil {
			log.Printf("webhook marshal error: %v", err)
			return
		}

		for i := 0; i < 3; i++ {
			resp, err := http.Post(url, "application/json", bytes.NewBuffer(data))
			if err == nil && resp.StatusCode < 500 {
				resp.Body.Close()
				return
			}
			if resp != nil {
				resp.Body.Close()
			}
			time.Sleep(time.Second * time.Duration(i+1))
		}
		log.Printf("webhook failed after retries: %s", url)
	}(p.WebhookURL, payload)
}

func (sc *Scheduler) escalationChecker() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			alerts := sc.store.GetAllAlerts()
			for _, alert := range alerts {
				if !alert.Escalated && !alert.Acknowledged {
					duration := time.Since(alert.StartTime)
					if duration >= 30*time.Minute {
						alert.Escalated = true
						alert.EscalationTime = time.Now()
						alert.Level = model.AlertLevelCritical

						if p, ok := sc.store.GetProbe(alert.ProbeID); ok {
							sc.sendWebhook(p, alert)
						}
					}
				}
			}
		case <-sc.stopCh:
			return
		}
	}
}
