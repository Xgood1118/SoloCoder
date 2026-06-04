package handler

import (
	"chatroom/hub"
	"chatroom/model"
	"chatroom/service"
	"encoding/json"
	"net/http"
	"strconv"
)

type MessageHandler struct {
	messageSvc *service.MessageService
	hub        *hub.Hub
}

func NewMessageHandler(msgs *service.MessageService, h *hub.Hub) *MessageHandler {
	return &MessageHandler{messageSvc: msgs, hub: h}
}

func (h *MessageHandler) Send(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	var req struct {
		UserID     string              `json:"user_id"`
		Username   string              `json:"username"`
		Type       model.MessageType   `json:"type"`
		Content    string              `json:"content"`
		MentionIDs []string            `json:"mention_ids,omitempty"`
		QuoteID    *string             `json:"quote_id,omitempty"`
	}
	if err := parseJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == "" || req.Content == "" {
		writeError(w, http.StatusBadRequest, "user_id and content are required")
		return
	}

	msg, err := h.messageSvc.Send(service.SendMessageReq{
		ChatroomID: chatroomID,
		UserID:     req.UserID,
		Username:   req.Username,
		Type:       req.Type,
		Content:    req.Content,
		MentionIDs: req.MentionIDs,
		QuoteID:    req.QuoteID,
	})
	if err != nil {
		status := http.StatusInternalServerError
		switch err {
		case service.ErrChatroomClosed:
			status = http.StatusForbidden
		case service.ErrNotMember, service.ErrUserMuted, service.ErrNotAdmin:
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}

	h.hub.BroadcastToChatroom(chatroomID, msg)

	if len(req.MentionIDs) > 0 {
		for _, uid := range req.MentionIDs {
			h.hub.SendToUser(uid, "mention", map[string]interface{}{
				"chatroom_id": chatroomID,
				"message_id":  msg.ID,
				"from_user":   req.Username,
				"content":     req.Content,
			})
		}
	}

	writeJSON(w, http.StatusCreated, msg)
}

func (h *MessageHandler) History(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 50
	}

	result, err := h.messageSvc.History(chatroomID, page, pageSize)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *MessageHandler) AddReaction(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	messageID := r.PathValue("message_id")
	var req struct {
		UserID string `json:"user_id"`
		Emoji  string `json:"emoji"`
	}
	if err := parseJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	msg, err := h.messageSvc.AddReaction(chatroomID, messageID, req.UserID, req.Emoji)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotMember {
			status = http.StatusForbidden
		}
		if err == service.ErrMessageNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, msg)
}

func (h *MessageHandler) RemoveReaction(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	messageID := r.PathValue("message_id")
	var req struct {
		UserID string `json:"user_id"`
		Emoji  string `json:"emoji"`
	}
	if err := parseJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.messageSvc.RemoveReaction(chatroomID, messageID, req.UserID, req.Emoji); err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrMessageNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "reaction_removed"})
}

func parseJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}
