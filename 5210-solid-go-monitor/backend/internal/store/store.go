package store

import (
	"sort"
	"sync"
	"time"

	"solid-go-monitor/internal/model"
)

type Store struct {
	probes      sync.Map
	results     sync.Map
	statuses    sync.Map
	failCounts  sync.Map
	events      []*model.Event
	eventsMu    sync.RWMutex
	alerts      sync.Map
	alertHistory []*model.Alert
	alertMu     sync.RWMutex
}

func NewStore() *Store {
	return &Store{
		events:      make([]*model.Event, 0, 1000),
		alertHistory: make([]*model.Alert, 0, 1000),
	}
}

func (s *Store) AddProbe(probe *model.Probe) {
	s.probes.Store(probe.ID, probe)
	s.results.Store(probe.ID, NewRingBuffer(100))
	s.statuses.Store(probe.ID, model.ProbeStatusUnknown)
	s.failCounts.Store(probe.ID, 0)
}

func (s *Store) GetProbe(id string) (*model.Probe, bool) {
	val, ok := s.probes.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*model.Probe), true
}

func (s *Store) GetAllProbes() []*model.Probe {
	probes := make([]*model.Probe, 0)
	s.probes.Range(func(_, val interface{}) bool {
		probes = append(probes, val.(*model.Probe))
		return true
	})
	return probes
}

func (s *Store) UpdateProbe(probe *model.Probe) {
	probe.UpdateTime = time.Now()
	s.probes.Store(probe.ID, probe)
}

func (s *Store) DeleteProbe(id string) {
	s.probes.Delete(id)
	s.results.Delete(id)
	s.statuses.Delete(id)
	s.failCounts.Delete(id)
	s.alerts.Delete(id)
}

func (s *Store) AddResult(probeID string, result *model.ProbeResult) {
	val, ok := s.results.Load(probeID)
	if ok {
		val.(*RingBuffer).Add(result)
	}
}

func (s *Store) GetResults(probeID string) []*model.ProbeResult {
	val, ok := s.results.Load(probeID)
	if !ok {
		return nil
	}
	return val.(*RingBuffer).GetAll()
}

func (s *Store) GetResultsSince(probeID string, since time.Time) []*model.ProbeResult {
	val, ok := s.results.Load(probeID)
	if !ok {
		return nil
	}
	return val.(*RingBuffer).GetSince(since)
}

func (s *Store) GetResultsRange(probeID string, since, until time.Time) []*model.ProbeResult {
	val, ok := s.results.Load(probeID)
	if !ok {
		return nil
	}
	return val.(*RingBuffer).GetRange(since, until)
}

func (s *Store) GetStats(probeID string) *model.ProbeStats {
	val, ok := s.results.Load(probeID)
	if !ok {
		return &model.ProbeStats{}
	}
	return val.(*RingBuffer).GetStats()
}

func (s *Store) GetLastFailures(probeID string, n int) []*model.ProbeResult {
	val, ok := s.results.Load(probeID)
	if !ok {
		return nil
	}
	return val.(*RingBuffer).GetLastFailures(n)
}

func (s *Store) GetStatus(probeID string) model.ProbeStatus {
	val, ok := s.statuses.Load(probeID)
	if !ok {
		return model.ProbeStatusUnknown
	}
	return val.(model.ProbeStatus)
}

func (s *Store) SetStatus(probeID string, status model.ProbeStatus) {
	s.statuses.Store(probeID, status)
}

func (s *Store) GetFailCount(probeID string) int {
	val, ok := s.failCounts.Load(probeID)
	if !ok {
		return 0
	}
	return val.(int)
}

func (s *Store) SetFailCount(probeID string, count int) {
	s.failCounts.Store(probeID, count)
}

func (s *Store) AddEvent(event *model.Event) {
	s.eventsMu.Lock()
	defer s.eventsMu.Unlock()

	s.events = append(s.events, event)
	if len(s.events) > 1000 {
		s.events = s.events[1:]
	}
}

func (s *Store) GetEvents(limit int) []*model.Event {
	s.eventsMu.RLock()
	defer s.eventsMu.RUnlock()

	start := 0
	if len(s.events) > limit {
		start = len(s.events) - limit
	}
	events := make([]*model.Event, len(s.events)-start)
	copy(events, s.events[start:])

	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.After(events[j].Timestamp)
	})
	return events
}

func (s *Store) AckEvent(eventID string, ackBy string) {
	s.eventsMu.Lock()
	defer s.eventsMu.Unlock()

	for _, e := range s.events {
		if e.ID == eventID {
			e.Acknowledged = true
			e.AckBy = ackBy
			e.AckTime = time.Now()
			break
		}
	}
}

func (s *Store) AddAlert(alert *model.Alert) {
	s.alerts.Store(alert.ProbeID, alert)
}

func (s *Store) GetAlert(probeID string) (*model.Alert, bool) {
	val, ok := s.alerts.Load(probeID)
	if !ok {
		return nil, false
	}
	return val.(*model.Alert), true
}

func (s *Store) GetAllAlerts() []*model.Alert {
	alerts := make([]*model.Alert, 0)
	s.alerts.Range(func(_, val interface{}) bool {
		alert := val.(*model.Alert)
		if !alert.Resolved {
			alerts = append(alerts, alert)
		}
		return true
	})
	return alerts
}

func (s *Store) ResolveAlert(probeID string) {
	val, ok := s.alerts.Load(probeID)
	if !ok {
		return
	}
	alert := val.(*model.Alert)
	alert.Resolved = true
	alert.EndTime = time.Now()
	alert.Duration = time.Since(alert.StartTime).Round(time.Second).String()
	alert.Status = model.ProbeStatusUp

	s.alertMu.Lock()
	s.alertHistory = append(s.alertHistory, alert)
	if len(s.alertHistory) > 1000 {
		s.alertHistory = s.alertHistory[1:]
	}
	s.alertMu.Unlock()

	s.alerts.Delete(probeID)
}

func (s *Store) AckAlert(probeID string, ackBy string) {
	val, ok := s.alerts.Load(probeID)
	if !ok {
		return
	}
	alert := val.(*model.Alert)
	alert.Acknowledged = true
	alert.AckBy = ackBy
	alert.AckTime = time.Now()
}

func (s *Store) SilenceAlert(probeID string, minutes int) {
	val, ok := s.alerts.Load(probeID)
	if !ok {
		return
	}
	alert := val.(*model.Alert)
	alert.Silenced = true
	alert.SilencedUntil = time.Now().Add(time.Duration(minutes) * time.Minute)
}

func (s *Store) GetAlertHistory(limit int) []*model.Alert {
	s.alertMu.RLock()
	defer s.alertMu.RUnlock()

	start := 0
	if len(s.alertHistory) > limit {
		start = len(s.alertHistory) - limit
	}
	history := make([]*model.Alert, len(s.alertHistory)-start)
	copy(history, s.alertHistory[start:])

	sort.Slice(history, func(i, j int) bool {
		return history[i].EndTime.After(history[j].EndTime)
	})
	return history
}

func (s *Store) GetGroups() []string {
	groupSet := make(map[string]bool)
	s.probes.Range(func(_, val interface{}) bool {
		probe := val.(*model.Probe)
		groupSet[probe.Group] = true
		return true
	})

	groups := make([]string, 0, len(groupSet))
	for g := range groupSet {
		groups = append(groups, g)
	}
	sort.Strings(groups)
	return groups
}
