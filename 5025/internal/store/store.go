package store

import (
	"approval-flow/internal/models"
	"context"
	"sync"
	"time"
)

type Store interface {
	SaveFlowDefinition(ctx context.Context, fd *models.FlowDefinition) error
	GetFlowDefinition(ctx context.Context, id string) (*models.FlowDefinition, error)
	ListFlowDefinitions(ctx context.Context) ([]*models.FlowDefinition, error)

	SaveFlowInstance(ctx context.Context, fi *models.FlowInstance) error
	GetFlowInstance(ctx context.Context, id string) (*models.FlowInstance, error)
	ListFlowInstances(ctx context.Context, flowDefID string) ([]*models.FlowInstance, error)
	ListFlowInstancesByStatus(ctx context.Context, status models.InstanceStatus) ([]*models.FlowInstance, error)

	SaveApprovalComment(ctx context.Context, ac *models.ApprovalComment) error
	GetApprovalComments(ctx context.Context, instanceID string) ([]*models.ApprovalComment, error)

	ListPendingInstancesForTimeoutCheck(ctx context.Context) ([]*models.FlowInstance, error)
}

type InMemoryStore struct {
	flowDefinitions map[string]*models.FlowDefinition
	flowInstances   map[string]*models.FlowInstance
	comments        map[string][]*models.ApprovalComment
	mu              sync.RWMutex
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		flowDefinitions: make(map[string]*models.FlowDefinition),
		flowInstances:   make(map[string]*models.FlowInstance),
		comments:        make(map[string][]*models.ApprovalComment),
	}
}

func (s *InMemoryStore) SaveFlowDefinition(ctx context.Context, fd *models.FlowDefinition) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	fd.UpdatedAt = time.Now()
	s.flowDefinitions[fd.ID] = fd
	return nil
}

func (s *InMemoryStore) GetFlowDefinition(ctx context.Context, id string) (*models.FlowDefinition, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	fd, ok := s.flowDefinitions[id]
	if !ok {
		return nil, nil
	}
	return fd, nil
}

func (s *InMemoryStore) ListFlowDefinitions(ctx context.Context) ([]*models.FlowDefinition, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*models.FlowDefinition, 0, len(s.flowDefinitions))
	for _, fd := range s.flowDefinitions {
		result = append(result, fd)
	}
	return result, nil
}

func (s *InMemoryStore) SaveFlowInstance(ctx context.Context, fi *models.FlowInstance) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	fi.UpdatedAt = time.Now()
	s.flowInstances[fi.ID] = fi
	return nil
}

func (s *InMemoryStore) GetFlowInstance(ctx context.Context, id string) (*models.FlowInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	fi, ok := s.flowInstances[id]
	if !ok {
		return nil, nil
	}
	return fi, nil
}

func (s *InMemoryStore) ListFlowInstances(ctx context.Context, flowDefID string) ([]*models.FlowInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*models.FlowInstance
	for _, fi := range s.flowInstances {
		if fi.FlowDefID == flowDefID {
			result = append(result, fi)
		}
	}
	return result, nil
}

func (s *InMemoryStore) ListFlowInstancesByStatus(ctx context.Context, status models.InstanceStatus) ([]*models.FlowInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*models.FlowInstance
	for _, fi := range s.flowInstances {
		if fi.Status == status {
			result = append(result, fi)
		}
	}
	return result, nil
}

func (s *InMemoryStore) SaveApprovalComment(ctx context.Context, ac *models.ApprovalComment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	ac.CreatedAt = time.Now()
	s.comments[ac.InstanceID] = append(s.comments[ac.InstanceID], ac)
	return nil
}

func (s *InMemoryStore) GetApprovalComments(ctx context.Context, instanceID string) ([]*models.ApprovalComment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.comments[instanceID], nil
}

func (s *InMemoryStore) ListPendingInstancesForTimeoutCheck(ctx context.Context) ([]*models.FlowInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*models.FlowInstance
	for _, fi := range s.flowInstances {
		if fi.Status == models.StatusRunning && fi.SuspendedAt == nil {
			result = append(result, fi)
		}
	}
	return result, nil
}
