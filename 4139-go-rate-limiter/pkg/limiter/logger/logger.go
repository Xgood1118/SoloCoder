package logger

import (
	"context"
	"fmt"
	"io"
	"log"
	"math/rand"
	"os"
	"sync"
	"time"
)

type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
)

type LogEventType string

const (
	EventLimitTriggered  LogEventType = "limit_triggered"
	EventRuleReloaded    LogEventType = "rule_reloaded"
	EventRedisFailover   LogEventType = "redis_failover"
	EventRedisRecovered  LogEventType = "redis_recovered"
	EventConfigError     LogEventType = "config_error"
	EventInternalError   LogEventType = "internal_error"
)

type LogEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       LogLevel               `json:"level"`
	EventType   LogEventType           `json:"event_type"`
	Message     string                 `json:"message"`
	Key         string                 `json:"key,omitempty"`
	RuleID      string                 `json:"rule_id,omitempty"`
	Algorithm   string                 `json:"algorithm,omitempty"`
	Limit       int64                  `json:"limit,omitempty"`
	Remaining   int64                  `json:"remaining,omitempty"`
	RetryAfter  int64                  `json:"retry_after_ms,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

type Logger struct {
	mu           sync.Mutex
	level        LogLevel
	output       io.Writer
	samplingRate float64
	async        bool
	asyncQueue   chan LogEntry
	ctx          context.Context
	cancel       context.CancelFunc
	nowFunc      func() time.Time
	rand         *rand.Rand
}

type Config struct {
	Level        LogLevel
	Output       io.Writer
	SamplingRate float64
	Async        bool
	AsyncBufSize int
}

func NewLogger(cfg Config) *Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}
	if cfg.SamplingRate <= 0 {
		cfg.SamplingRate = 1.0
	}
	if cfg.SamplingRate > 1.0 {
		cfg.SamplingRate = 1.0
	}
	if cfg.AsyncBufSize <= 0 {
		cfg.AsyncBufSize = 1000
	}

	ctx, cancel := context.WithCancel(context.Background())

	l := &Logger{
		level:        cfg.Level,
		output:       cfg.Output,
		samplingRate: cfg.SamplingRate,
		async:        cfg.Async,
		ctx:          ctx,
		cancel:       cancel,
		nowFunc:      time.Now,
		rand:         rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	if cfg.Async {
		l.asyncQueue = make(chan LogEntry, cfg.AsyncBufSize)
		go l.processAsync()
	}

	return l
}

func (l *Logger) processAsync() {
	for {
		select {
		case entry := <-l.asyncQueue:
			l.write(entry)
		case <-l.ctx.Done():
			for {
				select {
				case entry := <-l.asyncQueue:
					l.write(entry)
				default:
					return
				}
			}
		}
	}
}

func (l *Logger) shouldSample(eventType LogEventType) bool {
	switch eventType {
	case EventLimitTriggered:
		return l.rand.Float64() < l.samplingRate
	default:
		return true
	}
}

func (l *Logger) Log(entry LogEntry) {
	if entry.Level < l.level {
		return
	}

	if !l.shouldSample(entry.EventType) {
		return
	}

	if entry.Timestamp.IsZero() {
		entry.Timestamp = l.nowFunc()
	}

	if l.async {
		select {
		case l.asyncQueue <- entry:
		default:
		}
		return
	}

	l.write(entry)
}

func (l *Logger) write(entry LogEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()

	logLine := fmt.Sprintf(
		"[%s] %s %s: %s",
		entry.Timestamp.Format(time.RFC3339Nano),
		levelToString(entry.Level),
		entry.EventType,
		entry.Message,
	)

	if entry.Key != "" {
		logLine += fmt.Sprintf(" key=%s", entry.Key)
	}
	if entry.RuleID != "" {
		logLine += fmt.Sprintf(" rule_id=%s", entry.RuleID)
	}
	if entry.Algorithm != "" {
		logLine += fmt.Sprintf(" algorithm=%s", entry.Algorithm)
	}
	if entry.Limit > 0 {
		logLine += fmt.Sprintf(" limit=%d remaining=%d", entry.Limit, entry.Remaining)
	}
	if entry.RetryAfter > 0 {
		logLine += fmt.Sprintf(" retry_after=%dms", entry.RetryAfter)
	}
	if entry.Error != "" {
		logLine += fmt.Sprintf(" error=%s", entry.Error)
	}

	logLine += "\n"

	_, _ = l.output.Write([]byte(logLine))
}

func levelToString(level LogLevel) string {
	switch level {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

func (l *Logger) LimitTriggered(key, ruleID, algorithm string, limit, remaining, retryAfterMs int64, data map[string]interface{}) {
	l.Log(LogEntry{
		Level:      LevelWarn,
		EventType:  EventLimitTriggered,
		Message:    "Rate limit triggered",
		Key:        key,
		RuleID:     ruleID,
		Algorithm:  algorithm,
		Limit:      limit,
		Remaining:  remaining,
		RetryAfter: retryAfterMs,
		Data:       data,
	})
}

func (l *Logger) RuleReloaded(ruleCount int, version string) {
	l.Log(LogEntry{
		Level:     LevelInfo,
		EventType: EventRuleReloaded,
		Message:   fmt.Sprintf("Rules reloaded: count=%d, version=%s", ruleCount, version),
		Data: map[string]interface{}{
			"rule_count": ruleCount,
			"version":    version,
		},
	})
}

func (l *Logger) RedisFailover(err error) {
	l.Log(LogEntry{
		Level:     LevelError,
		EventType: EventRedisFailover,
		Message:   "Redis failed, switching to local mode",
		Error:     err.Error(),
	})
}

func (l *Logger) RedisRecovered() {
	l.Log(LogEntry{
		Level:     LevelInfo,
		EventType: EventRedisRecovered,
		Message:   "Redis recovered, switching back to distributed mode",
	})
}

func (l *Logger) ConfigError(err error, path string) {
	l.Log(LogEntry{
		Level:     LevelError,
		EventType: EventConfigError,
		Message:   fmt.Sprintf("Config error: %s", err.Error()),
		Data: map[string]interface{}{
			"path": path,
		},
		Error: err.Error(),
	})
}

func (l *Logger) InternalError(err error, operation string) {
	l.Log(LogEntry{
		Level:     LevelError,
		EventType: EventInternalError,
		Message:   fmt.Sprintf("Internal error during %s: %s", operation, err.Error()),
		Data: map[string]interface{}{
			"operation": operation,
		},
		Error: err.Error(),
	})
}

func (l *Logger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

func (l *Logger) SetSamplingRate(rate float64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if rate <= 0 {
		rate = 1.0
	}
	if rate > 1.0 {
		rate = 1.0
	}
	l.samplingRate = rate
}

func (l *Logger) Close() error {
	l.cancel()
	if l.asyncQueue != nil {
		close(l.asyncQueue)
	}
	return nil
}

var defaultLogger *Logger
var defaultOnce sync.Once

func Default() *Logger {
	defaultOnce.Do(func() {
		defaultLogger = NewLogger(Config{
			Level:        LevelInfo,
			Output:       os.Stdout,
			SamplingRate: 0.1,
			Async:        true,
			AsyncBufSize: 1000,
		})
	})
	return defaultLogger
}

func StandardLogger() *log.Logger {
	return log.New(os.Stderr, "", log.LstdFlags)
}
