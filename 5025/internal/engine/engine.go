package engine

import (
	"approval-flow/internal/condition"
	"approval-flow/internal/models"
	"approval-flow/internal/notification"
	"approval-flow/internal/store"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"time"
)

type Engine struct {
	store         store.Store
	condEngine    *condition.Engine
	notifService  *notification.NotificationService
	timeoutTicker *time.Ticker
	timeoutStop   chan struct{}
}

func NewEngine(s store.Store, ce *condition.Engine, ns *notification.NotificationService) *Engine {
	return &Engine{
		store:        s,
		condEngine:   ce,
		notifService: ns,
	}
}

func (e *Engine) StartTimeoutChecker(interval time.Duration) {
	e.timeoutTicker = time.NewTicker(interval)
	e.timeoutStop = make(chan struct{})
	go func() {
		for {
			select {
			case <-e.timeoutTicker.C:
				e.checkTimeouts(context.Background())
			case <-e.timeoutStop:
				return
			}
		}
	}()
}

func (e *Engine) StopTimeoutChecker() {
	if e.timeoutTicker != nil {
		e.timeoutTicker.Stop()
		close(e.timeoutStop)
	}
}

func (e *Engine) CreateFlowDefinition(ctx context.Context, fd *models.FlowDefinition) error {
	if fd.ID == "" {
		fd.ID = generateID()
	}
	fd.CreatedAt = time.Now()
	fd.UpdatedAt = time.Now()
	return e.store.SaveFlowDefinition(ctx, fd)
}

func (e *Engine) GetFlowDefinition(ctx context.Context, id string) (*models.FlowDefinition, error) {
	return e.store.GetFlowDefinition(ctx, id)
}

func (e *Engine) ListFlowDefinitions(ctx context.Context) ([]*models.FlowDefinition, error) {
	return e.store.ListFlowDefinitions(ctx)
}

func (e *Engine) StartInstance(ctx context.Context, flowDefID, title, initiator string, variables, data map[string]interface{}) (*models.FlowInstance, error) {
	fd, err := e.store.GetFlowDefinition(ctx, flowDefID)
	if err != nil {
		return nil, err
	}
	if fd == nil {
		return nil, fmt.Errorf("flow definition not found: %s", flowDefID)
	}

	startNode := e.getNodeByID(fd, fd.StartNodeID)
	if startNode == nil {
		return nil, fmt.Errorf("start node not found")
	}

	instance := &models.FlowInstance{
		ID:             generateID(),
		FlowDefID:      flowDefID,
		FlowDefVersion: fd.Version,
		Title:          title,
		Initiator:      initiator,
		CurrentNodeID:  fd.StartNodeID,
		Status:         models.StatusRunning,
		Variables:      variables,
		Data:           data,
		NodeEnteredAt:  time.Now(),
		ApprovalPath:   []string{fd.StartNodeID},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := e.store.SaveFlowInstance(ctx, instance); err != nil {
		return nil, err
	}

	e.addComment(ctx, instance.ID, fd.StartNodeID, initiator, models.ActionApprove, "发起申请")

	nextNodeID, err := e.evaluateNextNode(ctx, fd, startNode, instance)
	if err != nil {
		return nil, err
	}

	if nextNodeID != "" {
		if err := e.moveToNode(ctx, instance, fd, nextNodeID); err != nil {
			return nil, err
		}
	}

	return instance, nil
}

func (e *Engine) Approve(ctx context.Context, instanceID, approver, comment string) error {
	instance, err := e.store.GetFlowInstance(ctx, instanceID)
	if err != nil {
		return err
	}
	if instance == nil {
		return fmt.Errorf("instance not found: %s", instanceID)
	}
	if instance.Status != models.StatusRunning {
		return fmt.Errorf("instance is not running")
	}

	fd, err := e.store.GetFlowDefinition(ctx, instance.FlowDefID)
	if err != nil {
		return err
	}

	currentNode := e.getNodeByID(fd, instance.CurrentNodeID)
	if !e.isApprover(currentNode, approver) {
		return fmt.Errorf("user %s is not an approver for this node", approver)
	}

	e.addComment(ctx, instanceID, instance.CurrentNodeID, approver, models.ActionApprove, comment)

	nextNodeID, err := e.evaluateNextNode(ctx, fd, currentNode, instance)
	if err != nil {
		return err
	}

	if nextNodeID == "" {
		instance.Status = models.StatusApproved
		if err := e.store.SaveFlowInstance(ctx, instance); err != nil {
			return err
		}
		return e.notifService.NotifyApproved(ctx, instance.Initiator, instanceID, instance.Title, approver)
	}

	if err := e.moveToNode(ctx, instance, fd, nextNodeID); err != nil {
		return err
	}

	return nil
}

func (e *Engine) Reject(ctx context.Context, instanceID, approver, comment, targetNodeID string) error {
	instance, err := e.store.GetFlowInstance(ctx, instanceID)
	if err != nil {
		return err
	}
	if instance == nil {
		return fmt.Errorf("instance not found: %s", instanceID)
	}
	if instance.Status != models.StatusRunning {
		return fmt.Errorf("instance is not running")
	}

	fd, err := e.store.GetFlowDefinition(ctx, instance.FlowDefID)
	if err != nil {
		return err
	}

	currentNode := e.getNodeByID(fd, instance.CurrentNodeID)
	if !e.isApprover(currentNode, approver) {
		return fmt.Errorf("user %s is not an approver for this node", approver)
	}

	e.addComment(ctx, instanceID, instance.CurrentNodeID, approver, models.ActionReject, comment)

	var rejectNodeID string
	if targetNodeID != "" && targetNodeID != instance.Initiator {
		if !e.isNodeInPath(instance.ApprovalPath, targetNodeID) {
			return fmt.Errorf("target node %s is not in approval path", targetNodeID)
		}
		rejectNodeID = targetNodeID
	} else {
		rejectNodeID = fd.StartNodeID
	}

	if err := e.moveToNode(ctx, instance, fd, rejectNodeID); err != nil {
		return err
	}

	return e.notifService.NotifyRejected(ctx, instance.Initiator, instanceID, instance.Title, approver, comment)
}

func (e *Engine) Transfer(ctx context.Context, instanceID, fromApprover, toApprover, comment string) error {
	instance, err := e.store.GetFlowInstance(ctx, instanceID)
	if err != nil {
		return err
	}
	if instance == nil {
		return fmt.Errorf("instance not found: %s", instanceID)
	}
	if instance.Status != models.StatusRunning {
		return fmt.Errorf("instance is not running")
	}

	fd, err := e.store.GetFlowDefinition(ctx, instance.FlowDefID)
	if err != nil {
		return err
	}

	currentNode := e.getNodeByID(fd, instance.CurrentNodeID)
	if !e.isApprover(currentNode, fromApprover) {
		return fmt.Errorf("user %s is not an approver for this node", fromApprover)
	}

	e.addComment(ctx, instanceID, instance.CurrentNodeID, fromApprover, models.ActionTransfer, comment)

	currentNode.Approvers = append(currentNode.Approvers, toApprover)

	return e.notifService.NotifyTransferred(ctx, toApprover, instanceID, instance.Title, fromApprover)
}

func (e *Engine) Suspend(ctx context.Context, instanceID string) error {
	instance, err := e.store.GetFlowInstance(ctx, instanceID)
	if err != nil {
		return err
	}
	if instance == nil {
		return fmt.Errorf("instance not found: %s", instanceID)
	}
	if instance.Status != models.StatusRunning {
		return fmt.Errorf("instance is not running")
	}

	now := time.Now()
	instance.Status = models.StatusSuspended
	instance.SuspendedAt = &now

	return e.store.SaveFlowInstance(ctx, instance)
}

func (e *Engine) Activate(ctx context.Context, instanceID string) error {
	instance, err := e.store.GetFlowInstance(ctx, instanceID)
	if err != nil {
		return err
	}
	if instance == nil {
		return fmt.Errorf("instance not found: %s", instanceID)
	}
	if instance.Status != models.StatusSuspended {
		return fmt.Errorf("instance is not suspended")
	}

	instance.Status = models.StatusRunning
	instance.SuspendedAt = nil

	return e.store.SaveFlowInstance(ctx, instance)
}

func (e *Engine) GetInstance(ctx context.Context, instanceID string) (*models.FlowInstance, error) {
	return e.store.GetFlowInstance(ctx, instanceID)
}

func (e *Engine) GetApprovalHistory(ctx context.Context, instanceID string) ([]*models.ApprovalComment, error) {
	return e.store.GetApprovalComments(ctx, instanceID)
}

func (e *Engine) moveToNode(ctx context.Context, instance *models.FlowInstance, fd *models.FlowDefinition, nodeID string) error {
	instance.CurrentNodeID = nodeID
	instance.NodeEnteredAt = time.Now()
	instance.ApprovalPath = append(instance.ApprovalPath, nodeID)
	instance.TimeoutReminded = false

	if err := e.store.SaveFlowInstance(ctx, instance); err != nil {
		return err
	}

	node := e.getNodeByID(fd, nodeID)
	if node.Type == models.NodeTypeApproval {
		for _, approver := range node.Approvers {
			e.notifService.NotifyApprovalPending(ctx, approver, instance.ID, instance.Title, instance.Initiator)
		}
	} else if node.Type == models.NodeTypeCondition || node.Type == models.NodeTypeStart {
		nextNodeID, err := e.evaluateNextNode(ctx, fd, node, instance)
		if err != nil {
			return err
		}
		if nextNodeID != "" {
			return e.moveToNode(ctx, instance, fd, nextNodeID)
		}
	} else if node.Type == models.NodeTypeEnd {
		instance.Status = models.StatusApproved
		return e.store.SaveFlowInstance(ctx, instance)
	}

	return nil
}

func (e *Engine) evaluateNextNode(ctx context.Context, fd *models.FlowDefinition, currentNode *models.Node, instance *models.FlowInstance) (string, error) {
	if currentNode.Type == models.NodeTypeEnd {
		return "", nil
	}

	if len(currentNode.NextNodes) == 0 {
		return "", nil
	}

	hasConditions := false
	for _, nextNodeID := range currentNode.NextNodes {
		nextNode := e.getNodeByID(fd, nextNodeID)
		if nextNode == nil {
			continue
		}
		if len(nextNode.Conditions) > 0 {
			hasConditions = true
			ok, err := e.condEngine.Evaluate(ctx, nextNode.Conditions, instance.Variables)
			if err != nil {
				return "", fmt.Errorf("condition evaluation failed: %v", err)
			}
			if ok {
				return nextNodeID, nil
			}
		}
	}

	if !hasConditions {
		if len(currentNode.NextNodes) > 0 {
			return currentNode.NextNodes[0], nil
		}
		return "", nil
	}

	return "", fmt.Errorf("no branch condition matched for node %q, check that all required variables are provided", currentNode.Name)
}

func (e *Engine) checkTimeouts(ctx context.Context) {
	instances, err := e.store.ListPendingInstancesForTimeoutCheck(ctx)
	if err != nil {
		log.Printf("failed to list instances for timeout check: %v", err)
		return
	}

	for _, instance := range instances {
		fd, err := e.store.GetFlowDefinition(ctx, instance.FlowDefID)
		if err != nil {
			continue
		}
		currentNode := e.getNodeByID(fd, instance.CurrentNodeID)
		if currentNode == nil || currentNode.TimeoutConfig == nil {
			continue
		}

		elapsed := time.Since(instance.NodeEnteredAt)
		if elapsed >= currentNode.TimeoutConfig.Duration {
			e.handleTimeout(ctx, instance, currentNode)
		} else if elapsed >= currentNode.TimeoutConfig.Duration*3/4 && !instance.TimeoutReminded {
			for _, approver := range currentNode.Approvers {
				e.notifService.NotifyTimeoutReminder(ctx, approver, instance.ID, instance.Title)
			}
			instance.TimeoutReminded = true
			e.store.SaveFlowInstance(ctx, instance)
		}
	}
}

func (e *Engine) handleTimeout(ctx context.Context, instance *models.FlowInstance, node *models.Node) {
	switch node.TimeoutConfig.Action {
	case models.TimeoutAutoApprove:
		e.Approve(ctx, instance.ID, "system", "超时自动通过")
	case models.TimeoutAutoReject:
		e.Reject(ctx, instance.ID, "system", "超时自动驳回", "")
	case models.TimeoutReminder:
		for _, approver := range node.Approvers {
			e.notifService.NotifyTimeoutReminder(ctx, approver, instance.ID, instance.Title)
		}
	}
}

func (e *Engine) addComment(ctx context.Context, instanceID, nodeID, approver string, action models.ApprovalAction, content string) {
	comment := &models.ApprovalComment{
		ID:         generateID(),
		InstanceID: instanceID,
		NodeID:     nodeID,
		Approver:   approver,
		Action:     action,
		Content:    content,
	}
	e.store.SaveApprovalComment(ctx, comment)
}

func (e *Engine) getNodeByID(fd *models.FlowDefinition, nodeID string) *models.Node {
	for i := range fd.Nodes {
		if fd.Nodes[i].ID == nodeID {
			return &fd.Nodes[i]
		}
	}
	return nil
}

func (e *Engine) isApprover(node *models.Node, userID string) bool {
	for _, a := range node.Approvers {
		if a == userID {
			return true
		}
	}
	return false
}

func (e *Engine) isNodeInPath(path []string, nodeID string) bool {
	for _, n := range path {
		if n == nodeID {
			return true
		}
	}
	return false
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
