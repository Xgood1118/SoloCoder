package service

import (
	"chatroom/model"
	"chatroom/store"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrChatroomNotFound = errors.New("chatroom not found")
	ErrChatroomClosed   = errors.New("chatroom is shutdown")
	ErrNotAdmin         = errors.New("operation requires admin role")
)

type ChatroomService struct {
	store *store.Store
}

func NewChatroomService(s *store.Store) *ChatroomService {
	return &ChatroomService{store: s}
}

type CreateChatroomReq struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Type        model.ChatroomType `json:"type"`
	CreatorID   string            `json:"creator_id"`
}

func (svc *ChatroomService) Create(req CreateChatroomReq) (*model.Chatroom, error) {
	cr := &model.Chatroom{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Status:      model.ChatroomActive,
		CreatorID:   req.CreatorID,
		CreatedAt:   time.Now().UnixMilli(),
	}
	svc.store.SaveChatroom(cr)

	member := &model.Member{
		UserID:     req.CreatorID,
		ChatroomID: cr.ID,
		Role:       model.RoleAdmin,
		JoinedAt:   time.Now(),
	}
	svc.store.SaveMember(cr.ID, member)

	return cr, nil
}

func (svc *ChatroomService) Get(id string) (*model.Chatroom, error) {
	cr, ok := svc.store.GetChatroom(id)
	if !ok {
		return nil, ErrChatroomNotFound
	}
	return cr, nil
}

type UpdateChatroomReq struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

func (svc *ChatroomService) Update(chatroomID, operatorID string, req UpdateChatroomReq) (*model.Chatroom, error) {
	m, ok := svc.store.GetMember(chatroomID, operatorID)
	if !ok || !m.IsAdmin() {
		return nil, ErrNotAdmin
	}
	cr, ok := svc.store.UpdateChatroom(chatroomID, func(cr *model.Chatroom) {
		if req.Name != nil {
			cr.Name = *req.Name
		}
		if req.Description != nil {
			cr.Description = *req.Description
		}
	})
	if !ok {
		return nil, ErrChatroomNotFound
	}
	return cr, nil
}

func (svc *ChatroomService) Shutdown(chatroomID, operatorID string) error {
	m, ok := svc.store.GetMember(chatroomID, operatorID)
	if !ok || !m.IsAdmin() {
		return ErrNotAdmin
	}
	_, ok = svc.store.UpdateChatroom(chatroomID, func(cr *model.Chatroom) {
		cr.Status = model.ChatroomShutdown
	})
	if !ok {
		return ErrChatroomNotFound
	}
	return nil
}

func (svc *ChatroomService) IsShutdown(chatroomID string) (bool, error) {
	cr, ok := svc.store.GetChatroom(chatroomID)
	if !ok {
		return false, ErrChatroomNotFound
	}
	return cr.Status == model.ChatroomShutdown, nil
}

func (svc *ChatroomService) GetMember(chatroomID, userID string) (*model.Member, bool) {
	return svc.store.GetMember(chatroomID, userID)
}
