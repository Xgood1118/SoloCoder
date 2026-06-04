package service

import (
	"chatroom/model"
	"chatroom/store"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrAlreadyMember     = errors.New("already a member")
	ErrNotMember         = errors.New("not a member")
	ErrJoinRejected      = errors.New("join request rejected")
	ErrRequestNotFound   = errors.New("join request not found")
	ErrRequestNotPending = errors.New("join request is not pending")
	ErrCannotKickAdmin   = errors.New("cannot kick admin")
	ErrCannotMuteAdmin   = errors.New("cannot mute admin")
	ErrSelfKick          = errors.New("cannot kick yourself")
)

type MemberService struct {
	store *store.Store
}

func NewMemberService(s *store.Store) *MemberService {
	return &MemberService{store: s}
}

func (svc *MemberService) Join(chatroomID, userID string) (*model.Member, error) {
	cr, ok := svc.store.GetChatroom(chatroomID)
	if !ok {
		return nil, ErrChatroomNotFound
	}
	if cr.Status == model.ChatroomShutdown {
		return nil, ErrChatroomClosed
	}
	if _, ok := svc.store.GetMember(chatroomID, userID); ok {
		return nil, ErrAlreadyMember
	}

	if cr.Type == model.ChatroomClosed {
		req := &model.JoinRequest{
			ID:         uuid.New().String(),
			UserID:     userID,
			ChatroomID: chatroomID,
			Status:     model.JoinPending,
			CreatedAt:  time.Now(),
		}
		svc.store.SaveRequest(req)
		return nil, nil
	}

	m := &model.Member{
		UserID:     userID,
		ChatroomID: chatroomID,
		Role:       model.RoleMember,
		JoinedAt:   time.Now(),
	}
	svc.store.SaveMember(chatroomID, m)
	return m, nil
}

func (svc *MemberService) ApproveRequest(requestID, adminID string) (*model.Member, error) {
	req, ok := svc.store.GetRequest(requestID)
	if !ok {
		return nil, ErrRequestNotFound
	}
	if req.Status != model.JoinPending {
		return nil, ErrRequestNotPending
	}
	m, ok := svc.store.GetMember(req.ChatroomID, adminID)
	if !ok || !m.IsAdmin() {
		return nil, ErrNotAdmin
	}

	svc.store.UpdateRequest(requestID, func(r *model.JoinRequest) {
		r.Status = model.JoinApproved
	})

	member := &model.Member{
		UserID:     req.UserID,
		ChatroomID: req.ChatroomID,
		Role:       model.RoleMember,
		JoinedAt:   time.Now(),
	}
	svc.store.SaveMember(req.ChatroomID, member)
	return member, nil
}

func (svc *MemberService) RejectRequest(requestID, adminID string) error {
	req, ok := svc.store.GetRequest(requestID)
	if !ok {
		return ErrRequestNotFound
	}
	if req.Status != model.JoinPending {
		return ErrRequestNotPending
	}
	m, ok := svc.store.GetMember(req.ChatroomID, adminID)
	if !ok || !m.IsAdmin() {
		return ErrNotAdmin
	}
	svc.store.UpdateRequest(requestID, func(r *model.JoinRequest) {
		r.Status = model.JoinRejected
	})
	return nil
}

func (svc *MemberService) Leave(chatroomID, userID string) error {
	if _, ok := svc.store.GetMember(chatroomID, userID); !ok {
		return ErrNotMember
	}
	svc.store.RemoveMember(chatroomID, userID)
	return nil
}

func (svc *MemberService) Kick(chatroomID, adminID, targetID string) error {
	if adminID == targetID {
		return ErrSelfKick
	}
	admin, ok := svc.store.GetMember(chatroomID, adminID)
	if !ok || !admin.IsAdmin() {
		return ErrNotAdmin
	}
	target, ok := svc.store.GetMember(chatroomID, targetID)
	if !ok {
		return ErrNotMember
	}
	if target.IsAdmin() {
		return ErrCannotKickAdmin
	}
	svc.store.RemoveMember(chatroomID, targetID)
	return nil
}

type MuteReq struct {
	Duration int64 `json:"duration_seconds"`
}

func (svc *MemberService) Mute(chatroomID, adminID, targetID string, durationSec int64) error {
	admin, ok := svc.store.GetMember(chatroomID, adminID)
	if !ok || !admin.IsAdmin() {
		return ErrNotAdmin
	}
	target, ok := svc.store.GetMember(chatroomID, targetID)
	if !ok {
		return ErrNotMember
	}
	if target.IsAdmin() {
		return ErrCannotMuteAdmin
	}
	muteUntil := time.Now().Add(time.Duration(durationSec) * time.Second)
	svc.store.SaveMember(chatroomID, &model.Member{
		UserID:     target.UserID,
		ChatroomID: target.ChatroomID,
		Role:       target.Role,
		JoinedAt:   target.JoinedAt,
		Muted:      true,
		MuteUntil:  &muteUntil,
	})
	return nil
}

func (svc *MemberService) Unmute(chatroomID, adminID, targetID string) error {
	admin, ok := svc.store.GetMember(chatroomID, adminID)
	if !ok || !admin.IsAdmin() {
		return ErrNotAdmin
	}
	target, ok := svc.store.GetMember(chatroomID, targetID)
	if !ok {
		return ErrNotMember
	}
	svc.store.SaveMember(chatroomID, &model.Member{
		UserID:     target.UserID,
		ChatroomID: target.ChatroomID,
		Role:       target.Role,
		JoinedAt:   target.JoinedAt,
		Muted:      false,
		MuteUntil:  nil,
	})
	return nil
}

func (svc *MemberService) ListMembers(chatroomID string) ([]*model.Member, error) {
	if _, ok := svc.store.GetChatroom(chatroomID); !ok {
		return nil, ErrChatroomNotFound
	}
	return svc.store.ListMembers(chatroomID), nil
}

func (svc *MemberService) ListPendingRequests(chatroomID, adminID string) ([]*model.JoinRequest, error) {
	m, ok := svc.store.GetMember(chatroomID, adminID)
	if !ok || !m.IsAdmin() {
		return nil, ErrNotAdmin
	}
	return svc.store.ListPendingRequests(chatroomID), nil
}
