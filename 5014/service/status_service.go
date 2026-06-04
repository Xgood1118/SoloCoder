package service

import (
	"chatroom/model"
	"chatroom/store"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrUserNotFound = errors.New("user not found")
)

const (
	DefaultAwayTimeout = 10 * time.Minute
)

type StatusService struct {
	store       *store.Store
	awayTimeout time.Duration
}

func NewStatusService(s *store.Store, awayTimeout time.Duration) *StatusService {
	if awayTimeout == 0 {
		awayTimeout = DefaultAwayTimeout
	}
	return &StatusService{store: s, awayTimeout: awayTimeout}
}

func (svc *StatusService) Register(userID, username string) *model.User {
	u := &model.User{
		ID:       userID,
		Username: username,
		Status:   model.Online,
		JoinedAt: time.Now(),
	}
	svc.store.SaveUser(u)
	return u
}

func (svc *StatusService) SetOnline(userID string) error {
	svc.store.ClearAwayTimer(userID)
	_, ok := svc.store.UpdateUser(userID, func(u *model.User) {
		u.Status = model.Online
		u.AwayAt = nil
	})
	if !ok {
		return ErrUserNotFound
	}
	return nil
}

func (svc *StatusService) SetAway(userID string) error {
	now := time.Now()
	_, ok := svc.store.UpdateUser(userID, func(u *model.User) {
		u.Status = model.Away
		u.AwayAt = &now
	})
	if !ok {
		return ErrUserNotFound
	}

	timer := func() {
		svc.store.UpdateUser(userID, func(u *model.User) {
			if u.Status == model.Away {
				u.Status = model.Offline
				u.AwayAt = nil
			}
		})
	}
	t := time.AfterFunc(svc.awayTimeout, timer)
	svc.store.SetAwayTimer(userID, t)

	return nil
}

func (svc *StatusService) SetOffline(userID string) error {
	svc.store.ClearAwayTimer(userID)
	_, ok := svc.store.UpdateUser(userID, func(u *model.User) {
		u.Status = model.Offline
		u.AwayAt = nil
	})
	if !ok {
		return ErrUserNotFound
	}
	return nil
}

func (svc *StatusService) GetUser(userID string) (*model.User, error) {
	u, ok := svc.store.GetUser(userID)
	if !ok {
		return nil, ErrUserNotFound
	}
	return u, nil
}

func (svc *StatusService) EnsureUser(userID, username string) *model.User {
	if u, ok := svc.store.GetUser(userID); ok {
		return u
	}
	return svc.Register(userID, username)
}

func (svc *StatusService) GetUserChatrooms(userID string) []*model.Chatroom {
	return svc.store.GetUserChatrooms(userID)
}

func NewUserID() string {
	return uuid.New().String()
}
