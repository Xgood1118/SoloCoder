package logger

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/sms-gateway/internal/core"
)

type AsyncLogger struct {
	logChannel   chan *LogEntry
	sendLogChan  chan *core.SendLog
	wg           sync.WaitGroup
	stopChan     chan struct{}
	level        LogLevel
	logPath      string

	file        *os.File
	currentDate string
}

type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
)

type LogEntry struct {
	Level   LogLevel
	Message string
	Fields  map[string]interface{}
	Time    time.Time
}

func NewAsyncLogger(level string, logPath string, bufferSize int) *AsyncLogger {
	l := &AsyncLogger{
		logChannel:    make(chan *LogEntry, bufferSize),
		sendLogChan: make(chan *core.SendLog, bufferSize),
		stopChan:    make(chan struct{}),
		logPath:     logPath,
		level:       parseLevel(level),
	}

	if err := l.ensureLogDir(); err != nil {
		fmt.Printf("failed to create log dir: %v\n", err)
	}

	go l.processLogs()
	go l.processSendLogs()

	return l
}

func parseLevel(level string) LogLevel {
	switch level {
	case "debug":
		return LevelDebug
	case "info":
		return LevelInfo
	case "warn":
		return LevelWarn
	case "error":
		return LevelError
	default:
		return LevelInfo
	}
}

func (l *AsyncLogger) ensureLogDir() error {
	if l.logPath == "" {
		return nil
	}
	return os.MkdirAll(l.logPath, 0755)
}

func (l *AsyncLogger) getLogFile() (*os.File, error) {
	date := time.Now().Format("2006-01-02")
	if l.currentDate == date && l.file != nil {
		return l.file, nil
	}

	if l.file != nil {
		l.file.Close()
	}

	filename := filepath.Join(l.logPath, fmt.Sprintf("sms-%s.log", date))
	file, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}

	l.file = file
	l.currentDate = date
	return file, nil
}

func (l *AsyncLogger) processLogs() {
	l.wg.Add(1)
	defer l.wg.Done()

	for {
		select {
		case entry := <-l.logChannel:
			l.writeLog(entry)
		case <-l.stopChan:
			return
		}
	}
}

func (l *AsyncLogger) writeLog(entry *LogEntry) {
	logLine := l.formatLog(entry)
	
	fmt.Println(logLine)

	if l.logPath != "" {
		if file, err := l.getLogFile(); err == nil {
			file.WriteString(logLine + "\n")
		}
	}
}

func (l *AsyncLogger) formatLog(entry *LogEntry) string {
	levelStr := [...]string{"DEBUG", "INFO", "WARN", "ERROR"}
	fieldsJSON, _ := json.Marshal(entry.Fields)
	return fmt.Sprintf("[%s] [%s] %s %s",
		entry.Time.Format("2006-01-02 15:04:05"),
		levelStr[entry.Level],
		entry.Message,
		string(fieldsJSON),
	)
}

func (l *AsyncLogger) processSendLogs() {
	l.wg.Add(1)
	defer l.wg.Done()

	for {
		select {
		case sendLog := <-l.sendLogChan:
			l.writeSendLog(sendLog)
		case <-l.stopChan:
			return
		}
	}
}

func (l *AsyncLogger) writeSendLog(sendLog *core.SendLog) {
	logLine := fmt.Sprintf(
		"SEND_LOG|%s|%s|%s|%s|%s|%s|%dms|%s",
		sendLog.RequestTime.Format("2006-01-02 15:04:05"),
		sendLog.MessageID,
		sendLog.Phone,
		sendLog.TemplateID,
		sendLog.Channel,
		sendLog.Status,
		sendLog.Duration.Milliseconds(),
		sendLog.ExtCode,
	)
	
	if sendLog.Error != "" {
		logLine += "|" + sendLog.Error
	}

	fmt.Println(logLine)

	if l.logPath != "" {
		if file, err := l.getLogFile(); err == nil {
			file.WriteString(logLine + "\n")
		}
	}
}

func (l *AsyncLogger) Info(msg string, fields ...interface{}) {
	if l.level > LevelInfo {
		return
	}
	l.pushLog(LevelInfo, msg, fields...)
}

func (l *AsyncLogger) Error(msg string, fields ...interface{}) {
	if l.level > LevelError {
		return
	}
	l.pushLog(LevelError, msg, fields...)
}

func (l *AsyncLogger) Warn(msg string, fields ...interface{}) {
	if l.level > LevelWarn {
		return
	}
	l.pushLog(LevelWarn, msg, fields...)
}

func (l *AsyncLogger) Debug(msg string, fields ...interface{}) {
	if l.level > LevelDebug {
		return
	}
	l.pushLog(LevelDebug, msg, fields...)
}

func (l *AsyncLogger) pushLog(level LogLevel, msg string, fields ...interface{}) {
	fieldMap := make(map[string]interface{})
	for i := 0; i < len(fields); i += 2 {
		if i+1 < len(fields) {
			key, ok := fields[i].(string)
			if ok {
				fieldMap[key] = fields[i+1]
			}
		}
	}

	entry := &LogEntry{
		Level:   level,
		Message: msg,
		Fields:  fieldMap,
		Time:    time.Now(),
	}

	select {
	case l.logChannel <- entry:
	default:
	}
}

func (l *AsyncLogger) LogSend(sendLog *core.SendLog) {
	select {
	case l.sendLogChan <- sendLog:
	default:
	}
}

func (l *AsyncLogger) Stop() {
	close(l.stopChan)
	l.wg.Wait()
	if l.file != nil {
		l.file.Close()
	}
}

type Metrics struct {
	sendCounts   map[string]map[string]int64
	latencies    map[string][]float64
	channelHealth map[string]bool
	mu           sync.RWMutex
}

func NewMetrics() *Metrics {
	return &Metrics{
		sendCounts:   make(map[string]map[string]int64),
		latencies:    make(map[string][]float64),
		channelHealth: make(map[string]bool),
	}
}

func (m *Metrics) IncSendCount(channel string, status string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.sendCounts[channel]; !ok {
		m.sendCounts[channel] = make(map[string]int64)
	}
	m.sendCounts[channel][status]++
}

func (m *Metrics) ObserveLatency(channel string, duration float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.latencies[channel] = append(m.latencies[channel], duration)
	if len(m.latencies[channel]) > 1000 {
		m.latencies[channel] = m.latencies[channel][1:]
	}
}

func (m *Metrics) SetChannelHealth(channel string, healthy bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.channelHealth[channel] = healthy
}

func (m *Metrics) GetMetrics() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]interface{})

	totalSuccess := int64(0)
	totalFailed := int64(0)
	channelMetrics := make(map[string]interface{})

	for channel, counts := range m.sendCounts {
		success := counts["success"]
		failed := counts["failed"]
		totalSuccess += success
		totalFailed += failed

		latencies := m.latencies[channel]
		avgLatency := 0.0
		if len(latencies) > 0 {
			sum := 0.0
			for _, lat := range latencies {
				sum += lat
			}
			avgLatency = sum / float64(len(latencies))
		}

		channelMetrics[channel] = map[string]interface{}{
			"success":     success,
			"failed":      failed,
			"avg_latency":  avgLatency,
			"healthy":    m.channelHealth[channel],
		}
	}

	result["total"] = map[string]interface{}{
		"success": totalSuccess,
		"failed":  totalFailed,
	}
	result["channels"] = channelMetrics

	return result
}
