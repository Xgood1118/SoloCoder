package config

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/BurntSushi/toml"
	"github.com/fsnotify/fsnotify"
	"github.com/solo/ratelimiter/pkg/limiter/dimension"
)

type ConfigManager struct {
	mu           sync.RWMutex
	config       atomic.Value
	configPath   string
	watcher      *fsnotify.Watcher
	matcher      *RuleMatcher
	callbacks    []func(oldCfg, newCfg *Config)
	reloadCount  int64
	lastError    error
	lastReloadAt time.Time
	ctx          context.Context
	cancel       context.CancelFunc
	nowFunc      func() time.Time
}

func NewConfigManager() *ConfigManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &ConfigManager{
		matcher: NewRuleMatcher(),
		ctx:     ctx,
		cancel:  cancel,
		nowFunc: time.Now,
	}
}

func (m *ConfigManager) LoadFromJSON(path string) (*Config, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	cfg.LoadedAt = m.nowFunc()
	m.sortRules(&cfg)

	m.mu.Lock()
	oldCfg := m.getConfigLocked()
	m.config.Store(&cfg)
	m.configPath = path
	m.lastReloadAt = m.nowFunc()
	m.reloadCount++
	m.mu.Unlock()

	m.notifyCallbacks(oldCfg, &cfg)

	return &cfg, nil
}

func (m *ConfigManager) LoadFromTOML(path string) (*Config, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := toml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	cfg.LoadedAt = m.nowFunc()
	m.sortRules(&cfg)

	m.mu.Lock()
	oldCfg := m.getConfigLocked()
	m.config.Store(&cfg)
	m.configPath = path
	m.lastReloadAt = m.nowFunc()
	m.reloadCount++
	m.mu.Unlock()

	m.notifyCallbacks(oldCfg, &cfg)

	return &cfg, nil
}

func (m *ConfigManager) Load(cfg *Config) (*Config, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	cfg.LoadedAt = m.nowFunc()
	m.sortRules(cfg)

	m.mu.Lock()
	oldCfg := m.getConfigLocked()
	m.config.Store(cfg)
	m.lastReloadAt = m.nowFunc()
	m.reloadCount++
	m.mu.Unlock()

	m.notifyCallbacks(oldCfg, cfg)

	return cfg, nil
}

func (m *ConfigManager) HotReload() (*Config, error) {
	m.mu.RLock()
	path := m.configPath
	m.mu.RUnlock()

	if path == "" {
		return nil, ErrConfigNotLoaded
	}

	ext := filepath.Ext(path)
	var cfg *Config
	var err error

	switch ext {
	case ".json":
		cfg, err = m.LoadFromJSON(path)
	case ".toml", ".tml":
		cfg, err = m.LoadFromTOML(path)
	default:
		err = ErrHotReloadFailed
	}

	if err != nil {
		m.mu.Lock()
		m.lastError = err
		m.mu.Unlock()
		return nil, err
	}

	return cfg, nil
}

func (m *ConfigManager) Watch(path string) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	m.mu.Lock()
	if m.watcher != nil {
		m.watcher.Close()
	}
	m.watcher = watcher
	m.mu.Unlock()

	if err := watcher.Add(filepath.Dir(path)); err != nil {
		watcher.Close()
		return err
	}

	go m.watchLoop(path)

	return nil
}

func (m *ConfigManager) watchLoop(path string) {
	for {
		select {
		case event, ok := <-m.watcher.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
				if filepath.Clean(event.Name) == filepath.Clean(path) {
					time.Sleep(100 * time.Millisecond)
					_, _ = m.HotReload()
				}
			}
		case err, ok := <-m.watcher.Errors:
			if !ok {
				return
			}
			m.mu.Lock()
			m.lastError = err
			m.mu.Unlock()
		case <-m.ctx.Done():
			return
		}
	}
}

func (m *ConfigManager) GetConfig() *Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.getConfigLocked()
}

func (m *ConfigManager) getConfigLocked() *Config {
	if cfg := m.config.Load(); cfg != nil {
		return cfg.(*Config)
	}
	return nil
}

func (m *ConfigManager) GetRules() []Rule {
	cfg := m.GetConfig()
	if cfg == nil {
		return nil
	}
	return cfg.Rules
}

func (m *ConfigManager) GetRule(id string) (*Rule, error) {
	cfg := m.GetConfig()
	if cfg == nil {
		return nil, ErrConfigNotLoaded
	}

	for i := range cfg.Rules {
		if cfg.Rules[i].ID == id {
			return &cfg.Rules[i], nil
		}
	}

	return nil, ErrRuleNotFound
}

func (m *ConfigManager) Match(ctx interface{}) *RuleMatchResult {
	cfg := m.GetConfig()
	if cfg == nil || !cfg.Global.Enabled {
		return nil
	}

	reqCtx, ok := ctx.(*RequestContext)
	if !ok {
		return nil
	}

	dimCtx := &dimension.RequestContext{
		Request: reqCtx.Request,
		Path:    reqCtx.Path,
		UserID:  reqCtx.UserID,
		IP:      reqCtx.IP,
		Service: reqCtx.Service,
		Region:  reqCtx.Region,
		Headers: reqCtx.Headers,
		Query:   reqCtx.Query,
	}

	return m.matcher.Match(dimCtx, cfg.Rules)
}

func (m *ConfigManager) MatchAll(ctx interface{}) []RuleMatchResult {
	cfg := m.GetConfig()
	if cfg == nil || !cfg.Global.Enabled {
		return nil
	}

	reqCtx, ok := ctx.(*RequestContext)
	if !ok {
		return nil
	}

	dimCtx := &dimension.RequestContext{
		Request: reqCtx.Request,
		Path:    reqCtx.Path,
		UserID:  reqCtx.UserID,
		IP:      reqCtx.IP,
		Service: reqCtx.Service,
		Region:  reqCtx.Region,
		Headers: reqCtx.Headers,
		Query:   reqCtx.Query,
	}

	return m.matcher.MatchAll(dimCtx, cfg.Rules)
}

func (m *ConfigManager) AddReloadCallback(callback func(oldCfg, newCfg *Config)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.callbacks = append(m.callbacks, callback)
}

func (m *ConfigManager) notifyCallbacks(oldCfg, newCfg *Config) {
	m.mu.RLock()
	callbacks := make([]func(oldCfg, newCfg *Config), len(m.callbacks))
	copy(callbacks, m.callbacks)
	m.mu.RUnlock()

	m.invokeCallbacks(callbacks, oldCfg, newCfg)
}

func (m *ConfigManager) invokeCallbacks(callbacks []func(oldCfg, newCfg *Config), oldCfg, newCfg *Config) {
	for _, cb := range callbacks {
		func(c func(old, new *Config)) {
			defer func() {
				if r := recover(); r != nil {
				}
			}()
			c(oldCfg, newCfg)
		}(cb)
	}
}

func (m *ConfigManager) sortRules(cfg *Config) {
	sort.SliceStable(cfg.Rules, func(i, j int) bool {
		return cfg.Rules[i].Priority > cfg.Rules[j].Priority
	})
}

func (m *ConfigManager) AddRule(rule *Rule) error {
	if err := rule.Validate(); err != nil {
		return err
	}

	m.mu.Lock()
	cfg := m.getConfigLocked()
	if cfg == nil {
		m.mu.Unlock()
		return ErrConfigNotLoaded
	}

	newCfg := *cfg
	newCfg.Rules = make([]Rule, len(cfg.Rules))
	copy(newCfg.Rules, cfg.Rules)

	found := false
	for i, r := range newCfg.Rules {
		if r.ID == rule.ID {
			newCfg.Rules[i] = *rule
			found = true
			break
		}
	}

	if !found {
		rule.CreatedAt = m.nowFunc()
		rule.UpdatedAt = m.nowFunc()
		newCfg.Rules = append(newCfg.Rules, *rule)
	}

	m.sortRules(&newCfg)
	newCfg.LoadedAt = m.nowFunc()
	m.config.Store(&newCfg)
	m.reloadCount++
	m.lastReloadAt = m.nowFunc()

	callbacks := make([]func(oldCfg, newCfg *Config), len(m.callbacks))
	copy(callbacks, m.callbacks)
	m.mu.Unlock()

	m.invokeCallbacks(callbacks, cfg, &newCfg)

	return nil
}

func (m *ConfigManager) RemoveRule(id string) error {
	m.mu.Lock()
	cfg := m.getConfigLocked()
	if cfg == nil {
		m.mu.Unlock()
		return ErrConfigNotLoaded
	}

	newCfg := *cfg
	newCfg.Rules = make([]Rule, 0, len(cfg.Rules))

	for _, r := range cfg.Rules {
		if r.ID != id {
			newCfg.Rules = append(newCfg.Rules, r)
		}
	}

	if len(newCfg.Rules) == len(cfg.Rules) {
		m.mu.Unlock()
		return ErrRuleNotFound
	}

	newCfg.LoadedAt = m.nowFunc()
	m.config.Store(&newCfg)
	m.reloadCount++
	m.lastReloadAt = m.nowFunc()

	callbacks := make([]func(oldCfg, newCfg *Config), len(m.callbacks))
	copy(callbacks, m.callbacks)
	m.mu.Unlock()

	m.invokeCallbacks(callbacks, cfg, &newCfg)

	return nil
}

func (m *ConfigManager) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cfg := m.getConfigLocked()
	ruleCount := 0
	if cfg != nil {
		ruleCount = len(cfg.Rules)
	}

	return map[string]interface{}{
		"reload_count":  atomic.LoadInt64(&m.reloadCount),
		"last_reload_at": m.lastReloadAt,
		"last_error":     m.lastError,
		"rule_count":     ruleCount,
		"config_path":    m.configPath,
	}
}

func (m *ConfigManager) Close() error {
	m.cancel()
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.watcher != nil {
		if err := m.watcher.Close(); err != nil {
			return err
		}
		m.watcher = nil
	}

	return nil
}

type RequestContext struct {
	Request *http.Request
	Path    string
	UserID  string
	IP      string
	Service string
	Region  string
	Headers map[string]string
	Query   map[string]string
}
