package service

import (
	"chatroom/model"
	"chatroom/store"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrUserMuted       = errors.New("user is muted")
	ErrMessageNotFound = errors.New("message not found")
)

type MessageService struct {
	store *store.Store
}

func NewMessageService(s *store.Store) *MessageService {
	return &MessageService{store: s}
}

type SendMessageReq struct {
	ChatroomID string   `json:"chatroom_id"`
	UserID     string   `json:"user_id"`
	Username   string   `json:"username"`
	Type       model.MessageType `json:"type"`
	Content    string   `json:"content"`
	MentionIDs []string `json:"mention_ids,omitempty"`
	QuoteID    *string  `json:"quote_id,omitempty"`
}

func (svc *MessageService) Send(req SendMessageReq) (*model.Message, error) {
	shutdown, err := svc.isShutdown(req.ChatroomID)
	if err != nil {
		return nil, err
	}
	if shutdown {
		return nil, ErrChatroomClosed
	}

	member, ok := svc.store.GetMember(req.ChatroomID, req.UserID)
	if !ok {
		return nil, ErrNotMember
	}

	if req.Type == model.MsgNormal && member.IsMutedNow() {
		return nil, ErrUserMuted
	}

	if req.Type == model.MsgBroadcast && !member.IsAdmin() {
		return nil, ErrNotAdmin
	}

	var quoteMsg *string
	if req.QuoteID != nil {
		if q, ok := svc.store.GetMessage(req.ChatroomID, *req.QuoteID); ok {
			snippet := q.Content
			if len(snippet) > 100 {
				snippet = snippet[:100]
			}
			quoteMsg = &snippet
		}
	}

	msg := &model.Message{
		ID:         uuid.New().String(),
		ChatroomID: req.ChatroomID,
		UserID:     req.UserID,
		Username:   req.Username,
		Type:       req.Type,
		Content:    req.Content,
		MentionIDs: req.MentionIDs,
		QuoteID:    req.QuoteID,
		QuoteMsg:   quoteMsg,
		Reactions:  []model.Reaction{},
		CreatedAt:  time.Now().UnixMilli(),
	}

	svc.store.SaveMessage(req.ChatroomID, msg)
	return msg, nil
}

func (svc *MessageService) SendSystem(chatroomID, content string) (*model.Message, error) {
	msg := &model.Message{
		ID:         uuid.New().String(),
		ChatroomID: chatroomID,
		Type:       model.MsgSystem,
		Content:    content,
		Reactions:  []model.Reaction{},
		CreatedAt:  time.Now().UnixMilli(),
	}
	svc.store.SaveMessage(chatroomID, msg)
	return msg, nil
}

func (svc *MessageService) History(chatroomID string, page, pageSize int) (*model.PaginatedMessages, error) {
	if _, ok := svc.store.GetChatroom(chatroomID); !ok {
		return nil, ErrChatroomNotFound
	}
	return svc.store.GetMessages(chatroomID, page, pageSize), nil
}

func (svc *MessageService) AddReaction(chatroomID, messageID, userID, emoji string) (*model.Message, error) {
	shutdown, err := svc.isShutdown(chatroomID)
	if err != nil {
		return nil, err
	}
	if shutdown {
		return nil, ErrChatroomClosed
	}
	if _, ok := svc.store.GetMember(chatroomID, userID); !ok {
		return nil, ErrNotMember
	}

	var result *model.Message
	ok := svc.store.UpdateMessage(chatroomID, messageID, func(m *model.Message) {
		for _, r := range m.Reactions {
			if r.UserID == userID && r.Emoji == emoji {
				return
			}
		}
		m.Reactions = append(m.Reactions, model.Reaction{UserID: userID, Emoji: emoji})
		result = m
	})
	if !ok {
		return nil, ErrMessageNotFound
	}
	return result, nil
}

func (svc *MessageService) RemoveReaction(chatroomID, messageID, userID, emoji string) error {
	ok := svc.store.UpdateMessage(chatroomID, messageID, func(m *model.Message) {
		filtered := make([]model.Reaction, 0, len(m.Reactions))
		for _, r := range m.Reactions {
			if !(r.UserID == userID && r.Emoji == emoji) {
				filtered = append(filtered, r)
			}
		}
		m.Reactions = filtered
	})
	if !ok {
		return ErrMessageNotFound
	}
	return nil
}

func (svc *MessageService) isShutdown(chatroomID string) (bool, error) {
	cr, ok := svc.store.GetChatroom(chatroomID)
	if !ok {
		return false, ErrChatroomNotFound
	}
	return cr.Status == model.ChatroomShutdown, nil
}

func (svc *MessageService) GetMessage(chatroomID, messageID string) (*model.Message, bool) {
	return svc.store.GetMessage(chatroomID, messageID)
}
