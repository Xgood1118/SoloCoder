package datasource

import (
	"context"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
	"time"

	"github.com/olivere/elastic/v7"
)

type ESDatasource struct {
	*BaseDatasource
	cfg      *models.Datasource
	esCfg    *models.ESConfig
	client   *elastic.Client
	output   chan<- *models.LogEntry
	cancel   context.CancelFunc
	lastTime time.Time
}

func NewESDatasource(cfg *models.Datasource) *ESDatasource {
	return &ESDatasource{
		BaseDatasource: NewBaseDatasource(cfg.ID, models.DatasourceTypeElasticsearch),
		cfg:            cfg,
		lastTime:       time.Now(),
	}
}

func (e *ESDatasource) Start(ctx context.Context, output chan<- *models.LogEntry) error {
	var esCfg models.ESConfig
	if err := utils.FromJSON(e.cfg.Config, &esCfg); err != nil {
		return err
	}
	e.esCfg = &esCfg
	e.output = output

	ctx, e.cancel = context.WithCancel(ctx)

	client, err := elastic.NewClient(
		elastic.SetURL(esCfg.Addresses...),
		elastic.SetSniff(false),
	)
	if err != nil {
		return err
	}
	e.client = client

	go e.run(ctx)

	return nil
}

func (e *ESDatasource) run(ctx context.Context) {
	defer e.client.Stop()

	interval := time.Duration(e.esCfg.Interval) * time.Second
	if interval == 0 {
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.queryES(ctx)
		}
	}
}

func (e *ESDatasource) queryES(ctx context.Context) {
	query := e.buildQuery()

	searchResult, err := e.client.Search().
		Index(e.esCfg.Index).
		Query(query).
		Sort("@timestamp", false).
		Size(1000).
		Do(ctx)

	if err != nil {
		utils.Sugar.Errorf("ES query error: %v", err)
		e.IncrementError()
		return
	}

	now := time.Now()
	for _, hit := range searchResult.Hits.Hits {
		e.processHit(hit)
	}
	e.lastTime = now
}

func (e *ESDatasource) buildQuery() elastic.Query {
	boolQuery := elastic.NewBoolQuery()

	rangeQuery := elastic.NewRangeQuery("@timestamp").
		Gt(e.lastTime.Format(time.RFC3339))
	boolQuery.Filter(rangeQuery)

	if e.esCfg.Query != "" {
		queryStrQuery := elastic.NewQueryStringQuery(e.esCfg.Query)
		boolQuery.Must(queryStrQuery)
	}

	return boolQuery
}

func (e *ESDatasource) processHit(hit *elastic.SearchHit) {
	entry := models.NewLogEntry()
	entry.DatasourceID = e.ID()
	entry.Raw = string(hit.Source)

	if ts, ok := hit.Fields["@timestamp"]; ok {
		if t, err := time.Parse(time.RFC3339, ts.(string)); err == nil {
			entry.Timestamp = t
		}
	}

	if msg, ok := hit.Fields["message"]; ok {
		entry.Message = msg.(string)
	}

	if level, ok := hit.Fields["level"]; ok {
		entry.Level = level.(string)
	}

	select {
	case e.output <- entry:
		e.IncrementRecord()
	default:
		e.IncrementError()
		utils.Sugar.Warnf("Output channel full, dropping log from %s", e.ID())
	}
}

func (e *ESDatasource) Stop() error {
	if e.cancel != nil {
		e.cancel()
	}
	e.SetStatus(models.DatasourceStatusPaused)
	return nil
}

func (e *ESDatasource) Reload(cfg *models.Datasource) error {
	e.cfg = cfg
	var esCfg models.ESConfig
	if err := utils.FromJSON(cfg.Config, &esCfg); err != nil {
		return err
	}
	e.esCfg = &esCfg
	return nil
}
