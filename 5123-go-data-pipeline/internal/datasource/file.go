package datasource

import (
	"bufio"
	"context"
	"io"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
	"os"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
)

type FileDatasource struct {
	*BaseDatasource
	cfg     *models.Datasource
	fileCfg *models.FileConfig
	watcher *fsnotify.Watcher
	output  chan<- *models.LogEntry
	cancel  context.CancelFunc
}

func NewFileDatasource(cfg *models.Datasource) *FileDatasource {
	return &FileDatasource{
		BaseDatasource: NewBaseDatasource(cfg.ID, models.DatasourceTypeFile),
		cfg:            cfg,
	}
}

func (f *FileDatasource) Start(ctx context.Context, output chan<- *models.LogEntry) error {
	var fileCfg models.FileConfig
	if err := utils.FromJSON(f.cfg.Config, &fileCfg); err != nil {
		return err
	}
	f.fileCfg = &fileCfg
	f.output = output

	ctx, f.cancel = context.WithCancel(ctx)

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	f.watcher = watcher

	go f.run(ctx)

	return nil
}

func (f *FileDatasource) run(ctx context.Context) {
	defer f.watcher.Close()

	filePath := f.fileCfg.Path
	file, err := os.Open(filePath)
	if err != nil {
		utils.Sugar.Errorf("Failed to open file %s: %v", filePath, err)
		f.SetStatus(models.DatasourceStatusError)
		f.IncrementError()
		return
	}
	defer file.Close()

	if f.fileCfg.StartFromEnd {
		file.Seek(0, io.SeekEnd)
	}

	if err := f.watcher.Add(filepath.Dir(filePath)); err != nil {
		utils.Sugar.Errorf("Failed to watch directory: %v", err)
		f.SetStatus(models.DatasourceStatusError)
		f.IncrementError()
		return
	}

	reader := bufio.NewReader(file)

	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-f.watcher.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Write == fsnotify.Write && event.Name == filePath {
				f.readNewLines(reader)
			}
			if event.Op&fsnotify.Create == fsnotify.Create {
				if event.Name == filePath {
					newFile, err := os.Open(filePath)
					if err == nil {
						file.Close()
						file = newFile
						reader = bufio.NewReader(file)
						if f.fileCfg.StartFromEnd {
							file.Seek(0, io.SeekEnd)
						}
					}
				}
			}
		case err, ok := <-f.watcher.Errors:
			if !ok {
				return
			}
			utils.Sugar.Warnf("File watcher error: %v", err)
			f.IncrementError()
		}
	}
}

func (f *FileDatasource) readNewLines(reader *bufio.Reader) {
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		f.processLine(line)
	}
}

func (f *FileDatasource) processLine(line string) {
	entry := models.NewLogEntry()
	entry.DatasourceID = f.ID()
	entry.Raw = line
	entry.Message = line

	select {
	case f.output <- entry:
		f.IncrementRecord()
	default:
		f.IncrementError()
		utils.Sugar.Warnf("Output channel full, dropping log from %s", f.ID())
	}
}

func (f *FileDatasource) Stop() error {
	if f.cancel != nil {
		f.cancel()
	}
	f.SetStatus(models.DatasourceStatusPaused)
	return nil
}

func (f *FileDatasource) Reload(cfg *models.Datasource) error {
	f.cfg = cfg
	var fileCfg models.FileConfig
	if err := utils.FromJSON(cfg.Config, &fileCfg); err != nil {
		return err
	}
	f.fileCfg = &fileCfg
	return nil
}
