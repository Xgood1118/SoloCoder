package store

import (
	"errors"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
	"time"

	"gorm.io/gorm"
)

var ErrVersionConflict = errors.New("version conflict, please reload and try again")
var ErrNotFound = errors.New("record not found")

type DatasourceStore struct{}

func NewDatasourceStore() *DatasourceStore {
	return &DatasourceStore{}
}

func (s *DatasourceStore) List() ([]models.Datasource, error) {
	var datasources []models.Datasource
	err := utils.DB.Find(&datasources).Error
	return datasources, err
}

func (s *DatasourceStore) GetByID(id string) (*models.Datasource, error) {
	var ds models.Datasource
	err := utils.DB.Where("id = ?", id).First(&ds).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrNotFound
	}
	return &ds, err
}

func (s *DatasourceStore) Create(ds *models.Datasource) error {
	ds.ID = utils.GenerateID()
	ds.Version = 1
	ds.CreatedAt = time.Now()
	ds.UpdatedAt = time.Now()
	return utils.DB.Create(ds).Error
}

func (s *DatasourceStore) Update(ds *models.Datasource) error {
	existing, err := s.GetByID(ds.ID)
	if err != nil {
		return err
	}
	if existing.Version != ds.Version {
		return ErrVersionConflict
	}
	ds.Version++
	ds.UpdatedAt = time.Now()
	return utils.DB.Save(ds).Error
}

func (s *DatasourceStore) UpdateStatus(id string, status models.DatasourceStatus) error {
	return utils.DB.Model(&models.Datasource{}).Where("id = ?", id).Update("status", status).Error
}

func (s *DatasourceStore) Delete(id string) error {
	return utils.DB.Delete(&models.Datasource{}, id).Error
}

type PipelineStore struct{}

func NewPipelineStore() *PipelineStore {
	return &PipelineStore{}
}

func (s *PipelineStore) List() ([]models.Pipeline, error) {
	var pipelines []models.Pipeline
	err := utils.DB.Find(&pipelines).Error
	return pipelines, err
}

func (s *PipelineStore) GetByID(id string) (*models.Pipeline, error) {
	var p models.Pipeline
	err := utils.DB.Where("id = ?", id).First(&p).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrNotFound
	}
	return &p, err
}

func (s *PipelineStore) Create(p *models.Pipeline) error {
	p.ID = utils.GenerateID()
	p.Version = 1
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	return utils.DB.Create(p).Error
}

func (s *PipelineStore) Update(p *models.Pipeline) error {
	existing, err := s.GetByID(p.ID)
	if err != nil {
		return err
	}
	if existing.Version != p.Version {
		return ErrVersionConflict
	}
	p.Version++
	p.UpdatedAt = time.Now()
	return utils.DB.Save(p).Error
}

func (s *PipelineStore) UpdateStatus(id string, status models.PipelineStatus) error {
	return utils.DB.Model(&models.Pipeline{}).Where("id = ?", id).Update("status", status).Error
}

func (s *PipelineStore) Delete(id string) error {
	return utils.DB.Delete(&models.Pipeline{}, id).Error
}

type AlertRuleStore struct{}

func NewAlertRuleStore() *AlertRuleStore {
	return &AlertRuleStore{}
}

func (s *AlertRuleStore) List() ([]models.AlertRule, error) {
	var rules []models.AlertRule
	err := utils.DB.Find(&rules).Error
	return rules, err
}

func (s *AlertRuleStore) ListActive() ([]models.AlertRule, error) {
	var rules []models.AlertRule
	err := utils.DB.Where("status = ?", models.AlertStatusActive).Find(&rules).Error
	return rules, err
}

func (s *AlertRuleStore) GetByID(id string) (*models.AlertRule, error) {
	var rule models.AlertRule
	err := utils.DB.Where("id = ?", id).First(&rule).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrNotFound
	}
	return &rule, err
}

func (s *AlertRuleStore) Create(rule *models.AlertRule) error {
	rule.ID = utils.GenerateID()
	rule.Version = 1
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	return utils.DB.Create(rule).Error
}

func (s *AlertRuleStore) Update(rule *models.AlertRule) error {
	existing, err := s.GetByID(rule.ID)
	if err != nil {
		return err
	}
	if existing.Version != rule.Version {
		return ErrVersionConflict
	}
	rule.Version++
	rule.UpdatedAt = time.Now()
	return utils.DB.Save(rule).Error
}

func (s *AlertRuleStore) UpdateStatus(id string, status models.AlertStatus) error {
	return utils.DB.Model(&models.AlertRule{}).Where("id = ?", id).Update("status", status).Error
}

func (s *AlertRuleStore) Delete(id string) error {
	return utils.DB.Delete(&models.AlertRule{}, id).Error
}

func (s *AlertRuleStore) CreateHistory(h *models.AlertHistory) error {
	h.ID = utils.GenerateID()
	return utils.DB.Create(h).Error
}

func (s *AlertRuleStore) ListHistory(ruleID string, limit int) ([]models.AlertHistory, error) {
	var history []models.AlertHistory
	q := utils.DB.Order("triggered_at desc")
	if ruleID != "" {
		q = q.Where("rule_id = ?", ruleID)
	}
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Find(&history).Error
	return history, err
}

type AggregationStore struct{}

func NewAggregationStore() *AggregationStore {
	return &AggregationStore{}
}

func (s *AggregationStore) List() ([]models.AggregationRule, error) {
	var rules []models.AggregationRule
	err := utils.DB.Find(&rules).Error
	return rules, err
}

func (s *AggregationStore) GetByID(id string) (*models.AggregationRule, error) {
	var rule models.AggregationRule
	err := utils.DB.Where("id = ?", id).First(&rule).Error
	if err == gorm.ErrRecordNotFound {
		return nil, ErrNotFound
	}
	return &rule, err
}

func (s *AggregationStore) Create(rule *models.AggregationRule) error {
	rule.ID = utils.GenerateID()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	return utils.DB.Create(rule).Error
}

func (s *AggregationStore) Update(rule *models.AggregationRule) error {
	rule.UpdatedAt = time.Now()
	return utils.DB.Save(rule).Error
}

func (s *AggregationStore) Delete(id string) error {
	return utils.DB.Delete(&models.AggregationRule{}, id).Error
}
