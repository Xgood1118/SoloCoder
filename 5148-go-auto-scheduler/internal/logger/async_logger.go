package logger

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/scheduler/go-auto-scheduler/internal/models"
	"github.com/scheduler/go-auto-scheduler/internal/storage"
)

const (
	defaultBufferSize    = 1000
	defaultFlushInterval = 5 * time.Second
	defaultMaxFileSize   = 10 * 1024 * 1024
	defaultLogDir        = "./logs"
)

type LogEntry struct {
	TaskExecutionID string
	TaskID          string
	Timestamp       time.Time
	Level           string
	Content         string
	Source          string
}

type AsyncLogger struct {
	db            *storage.Database
	buffer        chan LogEntry
	bufferSize    int
	flushInterval time.Duration
	maxFileSize   int64
	logDir        string
	fileHandles   map[string]*os.File
	fileSizes     map[string]int64
	fileMu        sync.RWMutex
	wg            sync.WaitGroup
	ctx           chan struct{}
	running       bool
	index         map[string][]int64
	indexMu       sync.RWMutex
}

func NewAsyncLogger(db *storage.Database) *AsyncLogger {
	return &AsyncLogger{
		db:            db,
		buffer:        make(chan LogEntry, defaultBufferSize),
		bufferSize:    defaultBufferSize,
		flushInterval: defaultFlushInterval,
		maxFileSize:   defaultMaxFileSize,
		logDir:        defaultLogDir,
		fileHandles:   make(map[string]*os.File),
		fileSizes:     make(map[string]int64),
		index:         make(map[string][]int64),
		ctx:           make(chan struct{}),
	}
}

func (l *AsyncLogger) WithBufferSize(size int) *AsyncLogger {
	l.bufferSize = size
	l.buffer = make(chan LogEntry, size)
	return l
}

func (l *AsyncLogger) WithFlushInterval(interval time.Duration) *AsyncLogger {
	l.flushInterval = interval
	return l
}

func (l *AsyncLogger) WithMaxFileSize(size int64) *AsyncLogger {
	l.maxFileSize = size
	return l
}

func (l *AsyncLogger) WithLogDir(dir string) *AsyncLogger {
	l.logDir = dir
	return l
}

func (l *AsyncLogger) Start() error {
	if l.running {
		return nil
	}

	if err := os.MkdirAll(l.logDir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	l.running = true
	l.wg.Add(2)
	go l.bufferWriter()
	go l.periodicFlusher()

	return nil
}

func (l *AsyncLogger) Stop() {
	if !l.running {
		return
	}

	close(l.ctx)
	close(l.buffer)
	l.wg.Wait()

	l.fileMu.Lock()
	for _, f := range l.fileHandles {
		f.Close()
	}
	l.fileHandles = make(map[string]*os.File)
	l.fileMu.Unlock()

	l.running = false
}

func (l *AsyncLogger) Log(entry LogEntry) {
	if !l.running {
		return
	}

	select {
	case l.buffer <- entry:
	default:
		fmt.Printf("Log buffer full, dropping entry for task %s\n", entry.TaskID)
	}
}

func (l *AsyncLogger) LogStdout(taskExecutionID, taskID string, content string) {
	l.Log(LogEntry{
		TaskExecutionID: taskExecutionID,
		TaskID:          taskID,
		Timestamp:       time.Now(),
		Level:           "INFO",
		Content:         content,
		Source:          "stdout",
	})
}

func (l *AsyncLogger) LogStderr(taskExecutionID, taskID string, content string) {
	l.Log(LogEntry{
		TaskExecutionID: taskExecutionID,
		TaskID:          taskID,
		Timestamp:       time.Now(),
		Level:           "ERROR",
		Content:         content,
		Source:          "stderr",
	})
}

func (l *AsyncLogger) bufferWriter() {
	defer l.wg.Done()

	batch := make([]LogEntry, 0, l.bufferSize/2)
	ticker := time.NewTicker(l.flushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) > 0 {
			l.writeBatch(batch)
			batch = batch[:0]
		}
	}

	for {
		select {
		case <-l.ctx:
			for entry := range l.buffer {
				batch = append(batch, entry)
				if len(batch) >= l.bufferSize/2 {
					flush()
				}
			}
			flush()
			return
		case entry, ok := <-l.buffer:
			if !ok {
				flush()
				return
			}
			batch = append(batch, entry)
			if len(batch) >= l.bufferSize/2 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (l *AsyncLogger) periodicFlusher() {
	defer l.wg.Done()

	ticker := time.NewTicker(l.flushInterval * 2)
	defer ticker.Stop()

	for {
		select {
		case <-l.ctx:
			return
		case <-ticker.C:
			l.syncFiles()
		}
	}
}

func (l *AsyncLogger) writeBatch(entries []LogEntry) {
	dbEntries := make([]models.ExecutionLog, 0, len(entries))

	for _, entry := range entries {
		offset, err := l.writeToFile(entry)
		if err != nil {
			fmt.Printf("Failed to write log to file: %v\n", err)
		}

		dbEntries = append(dbEntries, models.ExecutionLog{
			TaskExecutionID: entry.TaskExecutionID,
			TaskID:          entry.TaskID,
			Timestamp:       entry.Timestamp,
			Level:           entry.Level,
			Content:         entry.Content,
			Source:          entry.Source,
			Offset:          offset,
		})
	}

	if err := l.db.BatchCreateExecutionLogs(dbEntries); err != nil {
		fmt.Printf("Failed to batch write logs to database: %v\n", err)
	}

	l.updateIndex(dbEntries)
}

func (l *AsyncLogger) getLogFileName(taskID string) string {
	return filepath.Join(l.logDir, fmt.Sprintf("task_%s.log", taskID))
}

func (l *AsyncLogger) getFile(taskID string) (*os.File, int64, error) {
	l.fileMu.RLock()
	f, exists := l.fileHandles[taskID]
	size := l.fileSizes[taskID]
	l.fileMu.RUnlock()

	if exists {
		return f, size, nil
	}

	l.fileMu.Lock()
	defer l.fileMu.Unlock()

	if f, exists := l.fileHandles[taskID]; exists {
		return f, l.fileSizes[taskID], nil
	}

	fileName := l.getLogFileName(taskID)
	dir := filepath.Dir(fileName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, 0, err
	}

	var file *os.File
	var fileSize int64

	if info, err := os.Stat(fileName); err == nil {
		fileSize = info.Size()
		if fileSize >= l.maxFileSize {
			rotatedName := fileName + fmt.Sprintf(".%d", time.Now().Unix())
			if err := os.Rename(fileName, rotatedName); err != nil {
				fmt.Printf("Failed to rotate log file: %v\n", err)
			}
			fileSize = 0
		}
	}

	var err error
	file, err = os.OpenFile(fileName, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, 0, err
	}

	l.fileHandles[taskID] = file
	l.fileSizes[taskID] = fileSize

	return file, fileSize, nil
}

func (l *AsyncLogger) writeToFile(entry LogEntry) (int64, error) {
	file, size, err := l.getFile(entry.TaskID)
	if err != nil {
		return 0, err
	}

	if size >= l.maxFileSize {
		l.rotateFile(entry.TaskID)
		file, size, err = l.getFile(entry.TaskID)
		if err != nil {
			return 0, err
		}
	}

	line := fmt.Sprintf("[%s] [%s] [%s] %s\n",
		entry.Timestamp.Format(time.RFC3339Nano),
		entry.Level,
		entry.Source,
		entry.Content,
	)

	offset := size
	n, err := file.WriteString(line)
	if err != nil {
		return offset, err
	}

	l.fileMu.Lock()
	l.fileSizes[entry.TaskID] = size + int64(n)
	l.fileMu.Unlock()

	return offset, nil
}

func (l *AsyncLogger) rotateFile(taskID string) {
	l.fileMu.Lock()
	defer l.fileMu.Unlock()

	file, exists := l.fileHandles[taskID]
	if !exists {
		return
	}

	file.Close()
	delete(l.fileHandles, taskID)

	oldName := l.getLogFileName(taskID)
	newName := oldName + fmt.Sprintf(".%d", time.Now().Unix())
	if err := os.Rename(oldName, newName); err != nil {
		fmt.Printf("Failed to rotate log file %s: %v\n", oldName, err)
	}

	l.fileSizes[taskID] = 0
}

func (l *AsyncLogger) syncFiles() {
	l.fileMu.RLock()
	defer l.fileMu.RUnlock()

	for _, f := range l.fileHandles {
		f.Sync()
	}
}

func (l *AsyncLogger) updateIndex(entries []models.ExecutionLog) {
	l.indexMu.Lock()
	defer l.indexMu.Unlock()

	for _, entry := range entries {
		if _, exists := l.index[entry.TaskID]; !exists {
			l.index[entry.TaskID] = make([]int64, 0)
		}
		l.index[entry.TaskID] = append(l.index[entry.TaskID], entry.Offset)
	}
}

func (l *AsyncLogger) GetTaskLogs(taskID string, page, pageSize int) ([]models.ExecutionLog, *models.Pagination, error) {
	pagination := &models.Pagination{
		Page:     page,
		PageSize: pageSize,
	}

	logs, err := l.db.ListExecutionLogs(taskID, pagination)
	if err != nil {
		return nil, nil, err
	}

	return logs, pagination, nil
}

func (l *AsyncLogger) DownloadTaskLogs(taskID string) (string, error) {
	fileName := l.getLogFileName(taskID)

	if _, err := os.Stat(fileName); os.IsNotExist(err) {
		execLogs, err := l.db.GetExecutionLogsByTaskID(taskID)
		if err != nil {
			return "", err
		}

		tmpFile, err := os.CreateTemp("", fmt.Sprintf("task_%s_*.log", taskID))
		if err != nil {
			return "", err
		}
		defer tmpFile.Close()

		writer := bufio.NewWriter(tmpFile)
		for _, log := range execLogs {
			line := fmt.Sprintf("[%s] [%s] [%s] %s\n",
				log.Timestamp.Format(time.RFC3339Nano),
				log.Level,
				log.Source,
				log.Content,
			)
			writer.WriteString(line)
		}
		writer.Flush()

		return tmpFile.Name(), nil
	}

	return fileName, nil
}

func (l *AsyncLogger) GetLogContent(taskID string, offset, limit int64) (string, error) {
	fileName := l.getLogFileName(taskID)

	file, err := os.Open(fileName)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if offset > 0 {
		if _, err := file.Seek(offset, 0); err != nil {
			return "", err
		}
	}

	reader := bufio.NewReader(file)
	buf := make([]byte, limit)
	n, err := reader.Read(buf)
	if err != nil && err.Error() != "EOF" {
		return "", err
	}

	return string(buf[:n]), nil
}

func (l *AsyncLogger) Tail(taskID string, lines int) ([]string, error) {
	fileName := l.getLogFileName(taskID)

	file, err := os.Open(fileName)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	fileSize := stat.Size()
	bufferSize := int64(1024)
	position := fileSize
	buffer := make([]byte, 0)
	lineCount := 0

	for position > 0 && lineCount < lines {
		readSize := bufferSize
		if position < bufferSize {
			readSize = position
		}
		position -= readSize

		_, err := file.Seek(position, 0)
		if err != nil {
			return nil, err
		}

		chunk := make([]byte, readSize)
		_, err = file.Read(chunk)
		if err != nil {
			return nil, err
		}

		buffer = append(chunk, buffer...)

		for i := len(chunk) - 1; i >= 0; i-- {
			if chunk[i] == '\n' {
				lineCount++
				if lineCount >= lines {
					position += int64(i) + 1
					break
				}
			}
		}
	}

	if lineCount == 0 {
		return []string{string(buffer)}, nil
	}

	_, err = file.Seek(position, 0)
	if err != nil {
		return nil, err
	}

	scanner := bufio.NewScanner(file)
	result := make([]string, 0, lines)
	for scanner.Scan() && len(result) < lines {
		result = append(result, scanner.Text())
	}

	return result, scanner.Err()
}
