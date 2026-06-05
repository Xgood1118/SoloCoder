package service

import (
	"fmt"
	"strconv"
	"time"

	"github.com/purchase-workflow/internal/model"
	"github.com/purchase-workflow/internal/repository"
	"github.com/purchase-workflow/pkg/logger"
	"gorm.io/gorm"
)

type WorkflowEngine struct {
	db *gorm.DB
}

func NewWorkflowEngine() *WorkflowEngine {
	return &WorkflowEngine{
		db: repository.GetDB(),
	}
}

func (e *WorkflowEngine) SubmitApplication(app *model.PurchaseApplication) error {
	return e.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		app.SubmittedAt = &now
		app.Status = "pending"

		startNode, err := e.getStartNode(app.WorkflowID)
		if err != nil {
			return err
		}
		app.CurrentNodeCode = startNode.NodeCode

		if err := tx.Create(app).Error; err != nil {
			return err
		}

		if err := e.createApprovalTasks(tx, app, startNode); err != nil {
			return err
		}

		if err := e.recordHistory(tx, app, startNode, nil, "submit", "申请提交"); err != nil {
			return err
		}

		if startNode.TimeoutHours > 0 {
			if err := e.createTimeoutMonitor(tx, app, startNode); err != nil {
				return err
			}
		}

		return nil
	})
}

func (e *WorkflowEngine) Approve(taskID uint64, approverID uint64, action string, opinion string) error {
	return e.db.Transaction(func(tx *gorm.DB) error {
		var task model.ApprovalTask
		if err := tx.Where("id = ? AND approver_id = ?", taskID, approverID).First(&task).Error; err != nil {
			return fmt.Errorf("审批任务不存在或无权限")
		}

		if task.ApprovalStatus != "pending" {
			return fmt.Errorf("该任务已处理")
		}

		var app model.PurchaseApplication
		if err := tx.Where("id = ?", task.ApplicationID).First(&app).Error; err != nil {
			return err
		}

		now := time.Now()
		task.ApprovalStatus = action
		task.ApprovalOpinion = opinion
		task.ApprovedAt = &now
		if err := tx.Save(&task).Error; err != nil {
			return err
		}

		currentNode, err := e.getNodeByCode(app.WorkflowID, app.CurrentNodeCode)
		if err != nil {
			return err
		}

		if action == "reject" {
			return e.handleReject(tx, &app, currentNode, &task, opinion)
		}

		return e.handleApprove(tx, &app, currentNode, &task, opinion)
	})
}

func (e *WorkflowEngine) handleReject(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode, task *model.ApprovalTask, opinion string) error {
	if node.ApprovalType == "countersign" {
		var pendingTasks int64
		tx.Model(&model.ApprovalTask{}).Where("application_id = ? AND node_code = ? AND approval_status = 'pending'", app.ID, app.CurrentNodeCode).Count(&pendingTasks)
		if pendingTasks > 0 {
			tx.Model(&model.ApprovalTask{}).Where("application_id = ? AND node_code = ? AND approval_status = 'pending'", app.ID, app.CurrentNodeCode).Update("approval_status", "rejected")
		}
	}

	app.Status = "rejected"
	app.CurrentNodeCode = "rejected"
	if err := tx.Save(app).Error; err != nil {
		return err
	}

	var approver model.User
	tx.Where("id = ?", task.ApproverID).First(&approver)

	return e.recordHistory(tx, app, node, &approver, "reject", opinion)
}

func (e *WorkflowEngine) handleApprove(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode, task *model.ApprovalTask, opinion string) error {
	var approver model.User
	tx.Where("id = ?", task.ApproverID).First(&approver)

	if err := e.recordHistory(tx, app, node, &approver, "approve", opinion); err != nil {
		return err
	}

	if node.ApprovalType == "countersign" {
		var approvedCount int64
		var totalCount int64
		tx.Model(&model.ApprovalTask{}).Where("application_id = ? AND node_code = ? AND approval_status = 'approved'", app.ID, app.CurrentNodeCode).Count(&approvedCount)
		tx.Model(&model.ApprovalTask{}).Where("application_id = ? AND node_code = ?", app.ID, app.CurrentNodeCode).Count(&totalCount)

		if approvedCount < totalCount {
			return nil
		}
	}

	nextNode, err := e.getNextNode(app, node)
	if err != nil {
		return err
	}

	if nextNode == nil {
		return e.completeApplication(tx, app, node, &approver)
	}

	app.CurrentNodeCode = nextNode.NodeCode
	app.UpdatedAt = time.Now()
	if err := tx.Save(app).Error; err != nil {
		return err
	}

	if err := e.createApprovalTasks(tx, app, nextNode); err != nil {
		return err
	}

	if nextNode.TimeoutHours > 0 {
		if err := e.createTimeoutMonitor(tx, app, nextNode); err != nil {
			return err
		}
	}

	return e.recordHistory(tx, app, nextNode, nil, "transfer", fmt.Sprintf("流转至%s", nextNode.NodeName))
}

func (e *WorkflowEngine) getNextNode(app *model.PurchaseApplication, currentNode *model.WorkflowNode) (*model.WorkflowNode, error) {
	var conditions []model.WorkflowCondition
	if err := e.db.Where("node_id = ?", currentNode.ID).Order("sort_order ASC").Find(&conditions).Error; err != nil {
		return nil, err
	}

	for _, condition := range conditions {
		if e.evaluateCondition(app, &condition) {
			var node model.WorkflowNode
			if err := e.db.Where("workflow_id = ? AND node_code = ?", app.WorkflowID, condition.TargetNodeCode).First(&node).Error; err != nil {
				return nil, err
			}
			return &node, nil
		}
	}

	var edges []model.WorkflowEdge
	if err := e.db.Where("workflow_id = ? AND from_node_code = ? AND edge_type = 'normal'", app.WorkflowID, currentNode.NodeCode).Find(&edges).Error; err != nil {
		return nil, err
	}

	if len(edges) == 0 {
		return nil, nil
	}

	var nextNode model.WorkflowNode
	if err := e.db.Where("workflow_id = ? AND node_code = ?", app.WorkflowID, edges[0].ToNodeCode).First(&nextNode).Error; err != nil {
		return nil, err
	}

	return &nextNode, nil
}

func (e *WorkflowEngine) evaluateCondition(app *model.PurchaseApplication, condition *model.WorkflowCondition) bool {
	var fieldValue string
	switch condition.FieldName {
	case "total_amount":
		fieldValue = fmt.Sprintf("%.2f", app.TotalAmount)
	case "department_id":
		fieldValue = fmt.Sprintf("%d", app.DepartmentID)
	case "application_type":
		fieldValue = app.ApplicationType
	default:
		return false
	}

	appVal, _ := strconv.ParseFloat(fieldValue, 64)
	condVal, _ := strconv.ParseFloat(condition.Value, 64)

	switch condition.Operator {
	case ">":
		return appVal > condVal
	case ">=":
		return appVal >= condVal
	case "<":
		return appVal < condVal
	case "<=":
		return appVal <= condVal
	case "==":
		return fieldValue == condition.Value
	case "!=":
		return fieldValue != condition.Value
	default:
		return false
	}
}

func (e *WorkflowEngine) completeApplication(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode, approver *model.User) error {
	now := time.Now()
	app.Status = "completed"
	app.CompletedAt = &now
	app.CurrentNodeCode = "completed"
	if err := tx.Save(app).Error; err != nil {
		return err
	}

	return e.recordHistory(tx, app, node, approver, "complete", "申请完成")
}

func (e *WorkflowEngine) Rollback(applicationID uint64, operatorID uint64, targetNodeCode string, reason string) error {
	return e.db.Transaction(func(tx *gorm.DB) error {
		var app model.PurchaseApplication
		if err := tx.Where("id = ?", applicationID).First(&app).Error; err != nil {
			return err
		}

		if app.Status != "pending" {
			return fmt.Errorf("只有待审批的申请才能回退")
		}

		var targetNode model.WorkflowNode
		if err := tx.Where("workflow_id = ? AND node_code = ?", app.WorkflowID, targetNodeCode).First(&targetNode).Error; err != nil {
			return fmt.Errorf("目标节点不存在")
		}

		tx.Model(&model.ApprovalTask{}).Where("application_id = ?", app.ID).Update("approval_status", "cancelled")

		app.CurrentNodeCode = targetNodeCode
		app.UpdatedAt = time.Now()
		if err := tx.Save(&app).Error; err != nil {
			return err
		}

		if err := e.createApprovalTasks(tx, &app, &targetNode); err != nil {
			return err
		}

		var operator model.User
		tx.Where("id = ?", operatorID).First(&operator)

		history := &model.ApprovalHistory{
			ApplicationID: app.ID,
			NodeCode:      targetNodeCode,
			NodeName:      targetNode.NodeName,
			ApproverID:    operatorID,
			ApproverName:  operator.RealName,
			Action:        "rollback",
			Opinion:       reason,
			FromNodeCode:  app.CurrentNodeCode,
			ToNodeCode:    targetNodeCode,
			CreatedAt:     time.Now(),
		}
		return tx.Create(history).Error
	})
}

func (e *WorkflowEngine) ProcessTimeouts() error {
	var monitors []model.TimeoutMonitor
	if err := e.db.Where("timeout_at <= ? AND is_handled = ?", time.Now(), false).Find(&monitors).Error; err != nil {
		return err
	}

	for _, monitor := range monitors {
		if err := e.processTimeout(&monitor); err != nil {
			logger.Error.Printf("处理超时任务失败: %v", err)
		}
	}

	return nil
}

func (e *WorkflowEngine) processTimeout(monitor *model.TimeoutMonitor) error {
	return e.db.Transaction(func(tx *gorm.DB) error {
		var app model.PurchaseApplication
		if err := tx.Where("id = ?", monitor.ApplicationID).First(&app).Error; err != nil {
			return err
		}

		if app.Status != "pending" || app.CurrentNodeCode != monitor.NodeCode {
			monitor.IsHandled = true
			now := time.Now()
			monitor.HandledAt = &now
			return tx.Save(monitor).Error
		}

		var node model.WorkflowNode
		if err := tx.Where("workflow_id = ? AND node_code = ?", app.WorkflowID, monitor.NodeCode).First(&node).Error; err != nil {
			return err
		}

		if node.TimeoutStrategy == "auto_approve" {
			return e.autoApproveTimeout(tx, &app, &node, monitor)
		}

		monitor.IsHandled = true
		now := time.Now()
		monitor.HandledAt = &now
		return tx.Save(monitor).Error
	})
}

func (e *WorkflowEngine) autoApproveTimeout(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode, monitor *model.TimeoutMonitor) error {
	var pendingTasks []model.ApprovalTask
	if err := tx.Where("application_id = ? AND node_code = ? AND approval_status = 'pending'", app.ID, node.NodeCode).Find(&pendingTasks).Error; err != nil {
		return err
	}

	now := time.Now()
	for _, task := range pendingTasks {
		task.ApprovalStatus = "auto_approved"
		task.ApprovalOpinion = "超时自动通过"
		task.ApprovedAt = &now
		tx.Save(&task)
	}

	if err := e.recordHistory(tx, app, node, nil, "auto_approve", "超时自动通过"); err != nil {
		return err
	}

	nextNode, err := e.getNextNode(app, node)
	if err != nil {
		return err
	}

	if nextNode == nil {
		return e.completeApplication(tx, app, node, nil)
	}

	app.CurrentNodeCode = nextNode.NodeCode
	app.UpdatedAt = now
	if err := tx.Save(app).Error; err != nil {
		return err
	}

	if err := e.createApprovalTasks(tx, app, nextNode); err != nil {
		return err
	}

	if nextNode.TimeoutHours > 0 {
		if err := e.createTimeoutMonitor(tx, app, nextNode); err != nil {
			return err
		}
	}

	monitor.IsHandled = true
	monitor.HandledAt = &now
	return tx.Save(monitor).Error
}

func (e *WorkflowEngine) getStartNode(workflowID uint64) (*model.WorkflowNode, error) {
	var node model.WorkflowNode
	err := e.db.Where("workflow_id = ? AND node_type = ?", workflowID, "start").First(&node).Error
	if err != nil {
		return nil, err
	}
	return &node, nil
}

func (e *WorkflowEngine) getNodeByCode(workflowID uint64, nodeCode string) (*model.WorkflowNode, error) {
	var node model.WorkflowNode
	err := e.db.Where("workflow_id = ? AND node_code = ?", workflowID, nodeCode).First(&node).Error
	if err != nil {
		return nil, err
	}
	return &node, nil
}

func (e *WorkflowEngine) createApprovalTasks(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode) error {
	if node.NodeType == "start" || node.NodeType == "end" {
		return nil
	}

	var approverIDs []uint64

	if len(node.ApprovalUserIDs) > 0 {
		approverIDs = node.ApprovalUserIDs
	} else if len(node.ApprovalRoles) > 0 {
		var users []model.User
		if err := tx.Where("role IN ?", node.ApprovalRoles).Find(&users).Error; err != nil {
			return err
		}
		for _, user := range users {
			approverIDs = append(approverIDs, user.ID)
		}
	}

	if len(approverIDs) == 0 {
		return fmt.Errorf("节点%s没有配置审批人", node.NodeName)
	}

	isSignatory := node.ApprovalType == "countersign"
	for _, approverID := range approverIDs {
		task := &model.ApprovalTask{
			ApplicationID: app.ID,
			NodeCode:      node.NodeCode,
			NodeName:      node.NodeName,
			ApproverID:    approverID,
			IsSignatory:   isSignatory,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if err := tx.Create(task).Error; err != nil {
			return err
		}
	}

	return nil
}

func (e *WorkflowEngine) createTimeoutMonitor(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode) error {
	monitor := &model.TimeoutMonitor{
		ApplicationID: app.ID,
		NodeCode:      node.NodeCode,
		TimeoutAt:     time.Now().Add(time.Duration(node.TimeoutHours) * time.Hour),
		CreatedAt:     time.Now(),
	}
	return tx.Create(monitor).Error
}

func (e *WorkflowEngine) recordHistory(tx *gorm.DB, app *model.PurchaseApplication, node *model.WorkflowNode, approver *model.User, action string, opinion string) error {
	history := &model.ApprovalHistory{
		ApplicationID: app.ID,
		NodeCode:      node.NodeCode,
		NodeName:      node.NodeName,
		Action:        action,
		Opinion:       opinion,
		CreatedAt:     time.Now(),
	}
	if approver != nil {
		history.ApproverID = approver.ID
		history.ApproverName = approver.RealName
	}
	return tx.Create(history).Error
}

func (e *WorkflowEngine) InitDefaultWorkflow(createdBy uint64) error {
	var count int64
	e.db.Model(&model.WorkflowDefinition{}).Where("code = ?", "purchase_approval").Count(&count)
	if count > 0 {
		return nil
	}

	return e.db.Transaction(func(tx *gorm.DB) error {
		wf := &model.WorkflowDefinition{
			Name:        "采购申请审批流程",
			Code:        "purchase_approval",
			Description: "标准采购申请审批流程，支持金额分流和多级审批",
			IsActive:    true,
			CreatedBy:   createdBy,
		}
		if err := tx.Create(wf).Error; err != nil {
			return err
		}

		nodes := []*model.WorkflowNode{
			{
				WorkflowID:   wf.ID,
				NodeCode:     "start",
				NodeName:     "提交申请",
				NodeType:     "start",
				ApprovalType: "none",
				SortOrder:    0,
			},
			{
				WorkflowID:    wf.ID,
				NodeCode:      "preliminary_review",
				NodeName:      "待初审",
				NodeType:      "approval",
				ApprovalType:  "single",
				ApprovalRoles: []string{"supervisor"},
				TimeoutHours:  24,
				TimeoutStrategy: "notify",
				SortOrder:     1,
			},
			{
				WorkflowID:    wf.ID,
				NodeCode:      "dept_manager_approval",
				NodeName:      "待部门经理审批",
				NodeType:      "approval",
				ApprovalType:  "single",
				ApprovalRoles: []string{"dept_manager"},
				TimeoutHours:  48,
				TimeoutStrategy: "notify",
				SortOrder:     2,
			},
			{
				WorkflowID:    wf.ID,
				NodeCode:      "finance_review",
				NodeName:      "待财务审核",
				NodeType:      "approval",
				ApprovalType:  "single",
				ApprovalRoles: []string{"finance"},
				TimeoutHours:  48,
				TimeoutStrategy: "auto_approve",
				SortOrder:     3,
			},
			{
				WorkflowID:    wf.ID,
				NodeCode:      "finance_manager_approval",
				NodeName:      "待财务经理审批",
				NodeType:      "approval",
				ApprovalType:  "countersign",
				ApprovalRoles: []string{"finance_manager", "risk_manager"},
				TimeoutHours:  72,
				TimeoutStrategy: "notify",
				SortOrder:     4,
			},
			{
				WorkflowID:   wf.ID,
				NodeCode:     "end",
				NodeName:     "完成",
				NodeType:     "end",
				ApprovalType: "none",
				SortOrder:    5,
			},
		}

		for _, node := range nodes {
			if err := tx.Create(node).Error; err != nil {
				return err
			}
		}

		var preliminaryNode model.WorkflowNode
		tx.Where("workflow_id = ? AND node_code = ?", wf.ID, "preliminary_review").First(&preliminaryNode)

		conditions := []*model.WorkflowCondition{
			{
				NodeID:         preliminaryNode.ID,
				ConditionType:  "amount",
				FieldName:      "total_amount",
				Operator:       "<",
				Value:          "1000",
				TargetNodeCode: "finance_review",
				SortOrder:      1,
			},
			{
				NodeID:         preliminaryNode.ID,
				ConditionType:  "amount",
				FieldName:      "total_amount",
				Operator:       ">=",
				Value:          "1000",
				TargetNodeCode: "dept_manager_approval",
				SortOrder:      2,
			},
		}

		for _, cond := range conditions {
			if err := tx.Create(cond).Error; err != nil {
				return err
			}
		}

		edges := []*model.WorkflowEdge{
			{
				WorkflowID:   wf.ID,
				FromNodeCode: "start",
				ToNodeCode:   "preliminary_review",
				EdgeType:     "normal",
			},
			{
				WorkflowID:   wf.ID,
				FromNodeCode: "dept_manager_approval",
				ToNodeCode:   "finance_manager_approval",
				EdgeType:     "normal",
			},
			{
				WorkflowID:   wf.ID,
				FromNodeCode: "finance_manager_approval",
				ToNodeCode:   "finance_review",
				EdgeType:     "normal",
			},
			{
				WorkflowID:   wf.ID,
				FromNodeCode: "finance_review",
				ToNodeCode:   "end",
				EdgeType:     "normal",
			},
		}

		for _, edge := range edges {
			if err := tx.Create(edge).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
