package store

import (
	"chatroom/model"
	"sync"
	"time"
)

type Store struct {
	mu         sync.RWMutex
	chatrooms  map[string]*model.Chatroom
	members    map[string]map[string]*model.Member
	messages   map[string][]*model.Message
	users      map[string]*model.User
	requests   map[string]*model.JoinRequest
	awayTimers map[string]*time.Timer
}

func New() *Store {
	return &Store{
		chatrooms:  make(map[string]*model.Chatroom),
		members:    make(map[string]map[string]*model.Member),
		messages:   make(map[string][]*model.Message),
		users:      make(map[string]*model.User),
		requests:   make(map[string]*model.JoinRequest),
		awayTimers: make(map[string]*time.Timer),
	}
}

func (s *Store) SaveChatroom(cr *model.Chatroom) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.chatrooms[cr.ID] = cr
	s.members[cr.ID] = make(map[string]*model.Member)
	s.messages[cr.ID] = make([]*model.Message, 0)
}

func (s *Store) GetChatroom(id string) (*model.Chatroom, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cr, ok := s.chatrooms[id]
	return cr, ok
}

func (s *Store) UpdateChatroom(id string, fn func(cr *model.Chatroom)) (*model.Chatroom, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cr, ok := s.chatrooms[id]
	if !ok {
		return nil, false
	}
	fn(cr)
	return cr, true
}

func (s *Store) SaveMember(chatroomID string, m *model.Member) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.members[chatroomID] == nil {
		s.members[chatroomID] = make(map[string]*model.Member)
	}
	s.members[chatroomID][m.UserID] = m
}

func (s *Store) GetMember(chatroomID, userID string) (*model.Member, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	members, ok := s.members[chatroomID]
	if !ok {
		return nil, false
	}
	m, ok := members[userID]
	return m, ok
}

func (s *Store) RemoveMember(chatroomID, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	members, ok := s.members[chatroomID]
	if !ok {
		return false
	}
	if _, exists := members[userID]; !exists {
		return false
	}
	delete(members, userID)
	return true
}

func (s *Store) ListMembers(chatroomID string) []*model.Member {
	s.mu.RLock()
	defer s.mu.RUnlock()
	members, ok := s.members[chatroomID]
	if !ok {
		return nil
	}
	result := make([]*model.Member, 0, len(members))
	for _, m := range members {
		result = append(result, m)
	}
	return result
}

func (s *Store) SaveMessage(chatroomID string, msg *model.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages[chatroomID] = append(s.messages[chatroomID], msg)
}

func (s *Store) GetMessages(chatroomID string, page, pageSize int) *model.PaginatedMessages {
	s.mu.RLock()
	defer s.mu.RUnlock()
	msgs, ok := s.messages[chatroomID]
	if !ok {
		return &model.PaginatedMessages{Messages: []model.Message{}, Total: 0, Page: page, PageSize: pageSize}
	}
	total := len(msgs)
	start := (page - 1) * pageSize
	if start >= total {
		return &model.PaginatedMessages{Messages: []model.Message{}, Total: total, Page: page, PageSize: pageSize}
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	result := make([]model.Message, 0, end-start)
	for i := start; i < end; i++ {
		result = append(result, *msgs[i])
	}
	return &model.PaginatedMessages{
		Messages: result,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		HasMore:  end < total,
	}
}

func (s *Store) GetMessage(chatroomID, messageID string) (*model.Message, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	msgs, ok := s.messages[chatroomID]
	if !ok {
		return nil, false
	}
	for _, m := range msgs {
		if m.ID == messageID {
			return m, true
		}
	}
	return nil, false
}

func (s *Store) UpdateMessage(chatroomID, messageID string, fn func(m *model.Message)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	msgs, ok := s.messages[chatroomID]
	if !ok {
		return false
	}
	for _, m := range msgs {
		if m.ID == messageID {
			fn(m)
			return true
		}
	}
	return false
}

func (s *Store) SaveUser(u *model.User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[u.ID] = u
}

func (s *Store) GetUser(id string) (*model.User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	return u, ok
}

func (s *Store) UpdateUser(id string, fn func(u *model.User)) (*model.User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return nil, false
	}
	fn(u)
	return u, true
}

func (s *Store) SaveRequest(r *model.JoinRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests[r.ID] = r
}

func (s *Store) GetRequest(id string) (*model.JoinRequest, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.requests[id]
	return r, ok
}

func (s *Store) UpdateRequest(id string, fn func(r *model.JoinRequest)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.requests[id]
	if !ok {
		return false
	}
	fn(r)
	return true
}

func (s *Store) ListPendingRequests(chatroomID string) []*model.JoinRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.JoinRequest, 0)
	for _, r := range s.requests {
		if r.ChatroomID == chatroomID && r.Status == model.JoinPending {
			result = append(result, r)
		}
	}
	return result
}

func (s *Store) SetAwayTimer(userID string, timer *time.Timer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if old, ok := s.awayTimers[userID]; ok {
		old.Stop()
	}
	s.awayTimers[userID] = timer
}

func (s *Store) ClearAwayTimer(userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t, ok := s.awayTimers[userID]; ok {
		t.Stop()
		delete(s.awayTimers, userID)
	}
}

func (s *Store) GetUserChatrooms(userID string) []*model.Chatroom {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.Chatroom, 0)
	for crID, members := range s.members {
		if _, ok := members[userID]; ok {
			if cr, ok := s.chatrooms[crID]; ok {
				result = append(result, cr)
			}
		}
	}
	return result
}
