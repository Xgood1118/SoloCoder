package channel

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/sms-gateway/internal/core"
)

type Manager struct {
	channels map[string]core.Channel
	groups   map[string][]core.Channel
	mu       sync.RWMutex

	selector core.ChannelSelector
	healthChecker *HealthChecker
}

func NewManager() *Manager {
	m := &Manager{
		channels: make(map[string]core.Channel),
		groups:   make(map[string][]core.Channel),
	}
	m.selector = NewWeightedRoundRobinSelector(m)
	m.healthChecker = NewHealthChecker(m)
	return m
}

func (m *Manager) Register(channel core.Channel) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	name := channel.Name()
	if _, exists := m.channels[name]; exists {
		return errors.New("channel already exists: " + name)
	}

	m.channels[name] = channel

	group := channel.Group()
	m.groups[group] = append(m.groups[group], channel)

	return nil
}

func (m *Manager) Unregister(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	channel, exists := m.channels[name]
	if !exists {
		return errors.New("channel not found: " + name)
	}

	delete(m.channels, name)

	group := channel.Group()
	if channels, ok := m.groups[group]; ok {
		for i, c := range channels {
			if c.Name() == name {
				m.groups[group] = append(channels[:i], channels[i+1:]...)
				break
			}
		}
	}

	return nil
}

func (m *Manager) Get(name string) (core.Channel, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	channel, exists := m.channels[name]
	if !exists {
		return nil, errors.New("channel not found: " + name)
	}
	return channel, nil
}

func (m *Manager) List() []core.Channel {
	m.mu.RLock()
	defer m.mu.RUnlock()

	channels := make([]core.Channel, 0, len(m.channels))
	for _, c := range m.channels {
		channels = append(channels, c)
	}
	return channels
}

func (m *Manager) ListByGroup(group string) []core.Channel {
	m.mu.RLock()
	defer m.mu.RUnlock()

	channels, exists := m.groups[group]
	if !exists {
		return nil
	}

	result := make([]core.Channel, len(channels))
	copy(result, channels)
	return result
}

func (m *Manager) SelectChannel(group string) (core.Channel, error) {
	return m.selector.Select(group)
}

func (m *Manager) GetAvailableChannels(group string) []core.Channel {
	channels := m.ListByGroup(group)
	available := make([]core.Channel, 0, len(channels))
	for _, c := range channels {
		if c.IsEnabled() && c.IsHealthy() {
			available = append(available, c)
		}
	}
	return available
}

func (m *Manager) StartHealthCheck() {
	m.healthChecker.Start()
}

func (m *Manager) StopHealthCheck() {
	m.healthChecker.Stop()
}

func (m *Manager) ReportSuccess(channelName string) {
	m.selector.ReportSuccess(channelName)
}

func (m *Manager) ReportFailure(channelName string) {
	m.selector.ReportFailure(channelName)
}

type WeightedRoundRobinSelector struct {
	manager    *Manager
	groupIndex map[string]int
	mu         sync.Mutex
}

func NewWeightedRoundRobinSelector(manager *Manager) *WeightedRoundRobinSelector {
	return &WeightedRoundRobinSelector{
		manager:    manager,
		groupIndex: make(map[string]int),
	}
}

func (s *WeightedRoundRobinSelector) Select(group string) (core.Channel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	channels := s.manager.GetAvailableChannels(group)
	if len(channels) == 0 {
		return nil, errors.New("no available channels in group: " + group)
	}

	idx, exists := s.groupIndex[group]
	if !exists || idx >= len(channels) {
		idx = 0
	}

	totalWeight := 0
	for _, c := range channels {
		totalWeight += c.Weight()
	}

	if totalWeight == 0 {
		s.groupIndex[group] = (idx + 1) % len(channels)
		return channels[idx], nil
	}

	currentWeight := 0
	selectedIdx := 0
	for i, c := range channels {
		currentWeight += c.Weight()
		if idx < currentWeight {
			selectedIdx = i
			break
		}
	}

	s.groupIndex[group] = (idx + 1) % totalWeight
	return channels[selectedIdx], nil
}

func (s *WeightedRoundRobinSelector) SelectAll(group string) []core.Channel {
	return s.manager.GetAvailableChannels(group)
}

func (s *WeightedRoundRobinSelector) ReportSuccess(channelName string) {
}

func (s *WeightedRoundRobinSelector) ReportFailure(channelName string) {
}

type HealthChecker struct {
	manager  *Manager
	stopChan chan struct{}
	running  bool
	mu       sync.Mutex
}

func NewHealthChecker(manager *Manager) *HealthChecker {
	return &HealthChecker{
		manager:  manager,
		stopChan: make(chan struct{}),
	}
}

func (hc *HealthChecker) Start() {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if hc.running {
		return
	}
	hc.running = true

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				hc.checkAllChannels()
			case <-hc.stopChan:
				return
			}
		}
	}()
}

func (hc *HealthChecker) Stop() {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if !hc.running {
		return
	}
	hc.running = false
	close(hc.stopChan)
}

func (hc *HealthChecker) checkAllChannels() {
	channels := hc.manager.List()
	for _, channel := range channels {
		if !channel.IsEnabled() {
			continue
		}
		go func(c core.Channel) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = c.HealthCheck(ctx)
		}(channel)
	}
}

func (hc *HealthChecker) Check(channel core.Channel) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return channel.HealthCheck(ctx)
}
