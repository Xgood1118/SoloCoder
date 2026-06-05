package datasource

import (
	"log-pipeline/internal/models"
	"sync/atomic"
	"time"
)

type BaseDatasource struct {
	id          string
	dsType      models.DatasourceType
	status      atomic.Value
	recordCount atomic.Int64
	errorCount  atomic.Int64
	lastUpdate  atomic.Value
}

func NewBaseDatasource(id string, dsType models.DatasourceType) *BaseDatasource {
	bd := &BaseDatasource{
		id:     id,
		dsType: dsType,
	}
	bd.status.Store(models.DatasourceStatusRunning)
	bd.lastUpdate.Store(time.Now())
	return bd
}

func (b *BaseDatasource) ID() string {
	return b.id
}

func (b *BaseDatasource) Type() models.DatasourceType {
	return b.dsType
}

func (b *BaseDatasource) Status() models.DatasourceStatus {
	return b.status.Load().(models.DatasourceStatus)
}

func (b *BaseDatasource) SetStatus(s models.DatasourceStatus) {
	b.status.Store(s)
}

func (b *BaseDatasource) Metrics() *models.DatasourceMetrics {
	return &models.DatasourceMetrics{
		DatasourceID: b.id,
		RecordCount:  b.recordCount.Load(),
		ErrorCount:   b.errorCount.Load(),
		Status:       string(b.Status()),
		Timestamp:    time.Now(),
	}
}

func (b *BaseDatasource) IncrementRecord() {
	b.recordCount.Add(1)
	b.lastUpdate.Store(time.Now())
}

func (b *BaseDatasource) IncrementError() {
	b.errorCount.Add(1)
	b.lastUpdate.Store(time.Now())
}

func (b *BaseDatasource) LastUpdate() time.Time {
	return b.lastUpdate.Load().(time.Time)
}
