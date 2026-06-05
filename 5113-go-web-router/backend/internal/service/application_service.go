package service

import (
	"fmt"
	"time"

	"github.com/purchase-workflow/internal/model"
	"github.com/purchase-workflow/internal/repository"
	"gorm.io/gorm"
)

type ApplicationService struct {
	db             *gorm.DB
	workflowEngine *WorkflowEngine
}

func NewApplicationService() *ApplicationService {
	return &ApplicationService{
		db:             repository.GetDB(),
		workflowEngine: NewWorkflowEngine(),
	}
}

func (s *ApplicationService) CreateApplication(userID uint64, req *model.CreateApplicationRequest) (*model.PurchaseApplication, error) {
	var workflow model.WorkflowDefinition
	if err := s.db.Where("code = ? AND is_active = ?", "purchase_approval", true).First(&workflow).Error; err != nil {
		return nil, fmt.Errorf("找不到可用的工作流")
	}

	var user model.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}

	applicationNo := fmt.Sprintf("PO%s", time.Now().Format("20060102150405"))

	totalAmount := 0.0
	for _, item := range req.Items {
		totalAmount += float64(item.Quantity) * item.UnitPrice
	}

	app := &model.PurchaseApplication{
		ApplicationNo:   applicationNo,
		Title:           req.Title,
		ApplicantID:     userID,
		DepartmentID:    user.DepartmentID,
		TotalAmount:     totalAmount,
		ApplicationType: req.ApplicationType,
		Description:     req.Description,
		AttachmentURLs:  req.AttachmentURLs,
		WorkflowID:      workflow.ID,
		Items:           req.Items,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.workflowEngine.SubmitApplication(app); err != nil {
		return nil, err
	}

	return app, nil
}

func (s *ApplicationService) GetMyApplications(userID uint64, page, pageSize int) ([]model.PurchaseApplication, int64, error) {
	var applications []model.PurchaseApplication
	var total int64

	query := s.db.Model(&model.PurchaseApplication{}).Where("applicant_id = ?", userID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Preload("Applicant").Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&applications).Error; err != nil {
		return nil, 0, err
	}

	return applications, total, nil
}

func (s *ApplicationService) GetApplicationDetail(id uint64) (*model.PurchaseApplication, error) {
	var app model.PurchaseApplication
	if err := s.db.Preload("Items").Preload("Applicant").Where("id = ?", id).First(&app).Error; err != nil {
		return nil, err
	}
	return &app, nil
}

func (s *ApplicationService) GetApprovalHistory(applicationID uint64) ([]model.ApprovalHistory, error) {
	var histories []model.ApprovalHistory
	if err := s.db.Where("application_id = ?", applicationID).Order("created_at ASC").Find(&histories).Error; err != nil {
		return nil, err
	}
	return histories, nil
}

func (s *ApplicationService) Approve(userID uint64, req *model.ApprovalRequest) error {
	return s.workflowEngine.Approve(req.TaskID, userID, req.Action, req.Opinion)
}

func (s *ApplicationService) Rollback(userID uint64, req *model.RollbackRequest) error {
	return s.workflowEngine.Rollback(req.ApplicationID, userID, req.TargetNodeCode, req.Reason)
}

func (s *ApplicationService) GetMyApprovalTasks(userID uint64, page, pageSize int, status string) ([]model.ApprovalTask, int64, error) {
	var tasks []model.ApprovalTask
	var total int64

	query := s.db.Model(&model.ApprovalTask{}).Where("approver_id = ?", userID)
	if status != "" {
		query = query.Where("approval_status = ?", status)
	}
	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Preload("Application").Preload("Approver").Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

func (s *ApplicationService) GetAvailableNodesForRollback(applicationID uint64) ([]model.WorkflowNode, error) {
	var app model.PurchaseApplication
	if err := s.db.Where("id = ?", applicationID).First(&app).Error; err != nil {
		return nil, err
	}

	var currentNode model.WorkflowNode
	if err := s.db.Where("workflow_id = ? AND node_code = ?", app.WorkflowID, app.CurrentNodeCode).First(&currentNode).Error; err != nil {
		return nil, err
	}

	var nodes []model.WorkflowNode
	if err := s.db.Where("workflow_id = ? AND sort_order < ? AND node_type = ?", app.WorkflowID, currentNode.SortOrder, "approval").Order("sort_order ASC").Find(&nodes).Error; err != nil {
		return nil, err
	}

	return nodes, nil
}
