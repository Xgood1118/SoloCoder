package datasource

import (
	"context"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
	"time"

	"github.com/segmentio/kafka-go"
)

type KafkaDatasource struct {
	*BaseDatasource
	cfg       *models.Datasource
	kafkaCfg  *models.KafkaConfig
	reader    *kafka.Reader
	output    chan<- *models.LogEntry
	cancel    context.CancelFunc
}

func NewKafkaDatasource(cfg *models.Datasource) *KafkaDatasource {
	return &KafkaDatasource{
		BaseDatasource: NewBaseDatasource(cfg.ID, models.DatasourceTypeKafka),
		cfg:            cfg,
	}
}

func (k *KafkaDatasource) Start(ctx context.Context, output chan<- *models.LogEntry) error {
	var kafkaCfg models.KafkaConfig
	if err := utils.FromJSON(k.cfg.Config, &kafkaCfg); err != nil {
		return err
	}
	k.kafkaCfg = &kafkaCfg
	k.output = output

	ctx, k.cancel = context.WithCancel(ctx)

	k.reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers:  kafkaCfg.Brokers,
		Topic:    kafkaCfg.Topic,
		GroupID:  kafkaCfg.GroupID,
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	go k.run(ctx)

	return nil
}

func (k *KafkaDatasource) run(ctx context.Context) {
	defer k.reader.Close()

	for {
		select {
		case <-ctx.Done():
			return
		default:
			msg, err := k.reader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				utils.Sugar.Errorf("Kafka read error: %v", err)
				k.IncrementError()
				k.SetStatus(models.DatasourceStatusError)
				time.Sleep(5 * time.Second)
				continue
			}
			k.processMessage(msg)
		}
	}
}

func (k *KafkaDatasource) processMessage(msg kafka.Message) {
	entry := models.NewLogEntry()
	entry.DatasourceID = k.ID()
	entry.Raw = string(msg.Value)
	entry.Message = string(msg.Value)

	if msg.Time != (time.Time{}) {
		entry.Timestamp = msg.Time
	}

	for _, h := range msg.Headers {
		entry.Tags[h.Key] = string(h.Value)
	}

	select {
	case k.output <- entry:
		k.IncrementRecord()
	default:
		k.IncrementError()
		utils.Sugar.Warnf("Output channel full, dropping log from %s", k.ID())
	}
}

func (k *KafkaDatasource) Stop() error {
	if k.cancel != nil {
		k.cancel()
	}
	k.SetStatus(models.DatasourceStatusPaused)
	return nil
}

func (k *KafkaDatasource) Reload(cfg *models.Datasource) error {
	k.cfg = cfg
	var kafkaCfg models.KafkaConfig
	if err := utils.FromJSON(cfg.Config, &kafkaCfg); err != nil {
		return err
	}
	k.kafkaCfg = &kafkaCfg
	return nil
}
