package main

import (
	"approval-flow/internal/condition"
	"approval-flow/internal/engine"
	"approval-flow/internal/models"
	"approval-flow/internal/notification"
	"approval-flow/internal/store"
	"context"
	"fmt"
	"log"
	"time"
)

func main() {
	ctx := context.Background()

	s := store.NewInMemoryStore()
	ce := condition.NewEngine()
	ns := notification.NewNotificationService()
	e := engine.NewEngine(s, ce, ns)

	fd := createSampleFlowDefinition()
	if err := e.CreateFlowDefinition(ctx, fd); err != nil {
		log.Fatalf("create flow failed: %v", err)
	}
	fmt.Printf("Created flow definition: %s\n", fd.ID)

	variables := map[string]interface{}{
		"amount": 5000.0,
		"department": "IT",
	}
	data := map[string]interface{}{
		"item": "服务器采购",
		"description": "购买新服务器",
	}

	instance, err := e.StartInstance(ctx, fd.ID, "服务器采购申请", "user001", variables, data)
	if err != nil {
		log.Fatalf("start instance failed: %v", err)
	}
	fmt.Printf("Started instance: %s, Current node: %s\n", instance.ID, instance.CurrentNodeID)

	fmt.Println("\n--- 部门经理审批 ---")
	if err := e.Approve(ctx, instance.ID, "manager01", "同意申请"); err != nil {
		log.Fatalf("approve failed: %v", err)
	}

	instance, _ = e.GetInstance(ctx, instance.ID)
	fmt.Printf("After manager approve, Current node: %s, Status: %s\n", instance.CurrentNodeID, instance.Status)

	fmt.Println("\n--- 查看审批历史 ---")
	comments, _ := e.GetApprovalHistory(ctx, instance.ID)
	for _, c := range comments {
		fmt.Printf("[%s] %s - %s: %s\n", c.CreatedAt.Format("15:04:05"), c.Approver, c.Action, c.Content)
	}

	fmt.Println("\n--- 财务总监审批 ---")
	if err := e.Approve(ctx, instance.ID, "finance01", "预算内，同意"); err != nil {
		log.Fatalf("approve failed: %v", err)
	}

	instance, _ = e.GetInstance(ctx, instance.ID)
	fmt.Printf("Final status: %s\n", instance.Status)

	fmt.Println("\n--- 最终审批历史 ---")
	comments, _ = e.GetApprovalHistory(ctx, instance.ID)
	for _, c := range comments {
		fmt.Printf("[%s] %s - %s: %s\n", c.CreatedAt.Format("15:04:05"), c.Approver, c.Action, c.Content)
	}

	fmt.Println("\n--- 测试驳回流程 ---")
	testRejectFlow(e, fd.ID)

	fmt.Println("\n--- 测试挂起和激活 ---")
	testSuspendFlow(e, fd.ID)
}

func createSampleFlowDefinition() *models.FlowDefinition {
	return &models.FlowDefinition{
		Name:        "采购审批流程",
		Description: "标准采购审批流程，含金额条件分支",
		Version:     1,
		CreatedBy:   "admin",
		StartNodeID: "start",
		Nodes: []models.Node{
			{
				ID:        "start",
				Name:      "开始",
				Type:      models.NodeTypeStart,
				NextNodes: []string{"manager_approval"},
				PositionX: 100,
				PositionY: 100,
			},
			{
				ID:        "manager_approval",
				Name:      "部门经理审批",
				Type:      models.NodeTypeApproval,
				Approvers: []string{"manager01"},
				NextNodes: []string{"condition_amount"},
				TimeoutConfig: &models.TimeoutConfig{
					Duration: 24 * time.Hour,
					Action:   models.TimeoutReminder,
				},
				PositionX: 100,
				PositionY: 200,
			},
			{
				ID:   "condition_amount",
				Name: "金额判断",
				Type: models.NodeTypeCondition,
				NextNodes: []string{"finance_approval", "director_approval"},
				PositionX: 100,
				PositionY: 300,
			},
			{
				ID:   "finance_approval",
				Name: "财务总监审批",
				Type: models.NodeTypeApproval,
				Approvers: []string{"finance01"},
				Conditions: []models.Condition{
					{
						Type:     models.ConditionAmount,
						Field:    "amount",
						Operator: models.OpLt,
						Value:    10000.0,
					},
				},
				NextNodes: []string{"end"},
				TimeoutConfig: &models.TimeoutConfig{
					Duration: 48 * time.Hour,
					Action:   models.TimeoutAutoApprove,
				},
				PositionX: 50,
				PositionY: 400,
			},
			{
				ID:   "director_approval",
				Name: "总经理审批",
				Type: models.NodeTypeApproval,
				Approvers: []string{"director01"},
				Conditions: []models.Condition{
					{
						Type:     models.ConditionAmount,
						Field:    "amount",
						Operator: models.OpGte,
						Value:    10000.0,
					},
				},
				NextNodes: []string{"end"},
				PositionX: 200,
				PositionY: 400,
			},
			{
				ID:        "end",
				Name:      "结束",
				Type:      models.NodeTypeEnd,
				NextNodes: []string{},
				PositionX: 100,
				PositionY: 500,
			},
		},
	}
}

func testRejectFlow(e *engine.Engine, flowDefID string) {
	ctx := context.Background()
	variables := map[string]interface{}{"amount": 3000.0}
	data := map[string]interface{}{"item": "测试驳回"}

	instance, err := e.StartInstance(ctx, flowDefID, "测试驳回申请", "user002", variables, data)
	if err != nil {
		log.Printf("start instance failed: %v", err)
		return
	}

	if err := e.Reject(ctx, instance.ID, "manager01", "资料不全，请补充", ""); err != nil {
		log.Printf("reject failed: %v", err)
		return
	}

	instance, _ = e.GetInstance(ctx, instance.ID)
	fmt.Printf("After reject, Current node: %s, Status: %s\n", instance.CurrentNodeID, instance.Status)

	comments, _ := e.GetApprovalHistory(ctx, instance.ID)
	for _, c := range comments {
		fmt.Printf("  [%s] %s: %s\n", c.Action, c.Approver, c.Content)
	}
}

func testSuspendFlow(e *engine.Engine, flowDefID string) {
	ctx := context.Background()
	variables := map[string]interface{}{"amount": 3000.0}

	instance, err := e.StartInstance(ctx, flowDefID, "测试挂起申请", "user003", variables, nil)
	if err != nil {
		log.Printf("start instance failed: %v", err)
		return
	}

	fmt.Printf("Before suspend, status: %s\n", instance.Status)

	if err := e.Suspend(ctx, instance.ID); err != nil {
		log.Printf("suspend failed: %v", err)
		return
	}

	instance, _ = e.GetInstance(ctx, instance.ID)
	fmt.Printf("After suspend, status: %s, suspended at: %v\n", instance.Status, instance.SuspendedAt)

	if err := e.Activate(ctx, instance.ID); err != nil {
		log.Printf("activate failed: %v", err)
		return
	}

	instance, _ = e.GetInstance(ctx, instance.ID)
	fmt.Printf("After activate, status: %s\n", instance.Status)
}
