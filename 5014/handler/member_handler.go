package handler

import (
	"chatroom/hub"
	"chatroom/service"
	"encoding/json"
	"net/http"
)

type MemberHandler struct {
	memberSvc  *service.MemberService
	messageSvc *service.MessageService
	hub        *hub.Hub
}

func NewMemberHandler(ms *service.MemberService, msgs *service.MessageService, h *hub.Hub) *MemberHandler {
	return &MemberHandler{memberSvc: ms, messageSvc: msgs, hub: h}
}

func (h *MemberHandler) Join(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "user_id is required")
		return
	}

	member, err := h.memberSvc.Join(chatroomID, req.UserID)
	if err != nil {
		if err == service.ErrChatroomClosed {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		if err == service.ErrAlreadyMember {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if member == nil {
		writeJSON(w, http.StatusAccepted, map[string]string{
			"status":  "pending_approval",
			"message": "join request submitted, waiting for admin approval",
		})
		return
	}

	writeJSON(w, http.StatusOK, member)
}

func (h *MemberHandler) Leave(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.memberSvc.Leave(chatroomID, req.UserID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "left"})
}

func (h *MemberHandler) Kick(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	targetID := r.PathValue("user_id")
	var req struct {
		AdminID string `json:"admin_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.memberSvc.Kick(chatroomID, req.AdminID, targetID); err != nil {
		status := http.StatusInternalServerError
		switch err {
		case service.ErrNotAdmin:
			status = http.StatusForbidden
		case service.ErrNotMember, service.ErrCannotKickAdmin, service.ErrSelfKick:
			status = http.StatusBadRequest
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "kicked"})
}

func (h *MemberHandler) Mute(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	targetID := r.PathValue("user_id")
	var req struct {
		AdminID        string `json:"admin_id"`
		DurationSeconds int64  `json:"duration_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.DurationSeconds <= 0 {
		req.DurationSeconds = 3600
	}
	if err := h.memberSvc.Mute(chatroomID, req.AdminID, targetID, req.DurationSeconds); err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "muted"})
}

func (h *MemberHandler) Unmute(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	targetID := r.PathValue("user_id")
	var req struct {
		AdminID string `json:"admin_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.memberSvc.Unmute(chatroomID, req.AdminID, targetID); err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unmuted"})
}

func (h *MemberHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	members, err := h.memberSvc.ListMembers(chatroomID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *MemberHandler) ApproveRequest(w http.ResponseWriter, r *http.Request) {
	requestID := r.PathValue("request_id")
	var req struct {
		AdminID string `json:"admin_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, err := h.memberSvc.ApproveRequest(requestID, req.AdminID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *MemberHandler) RejectRequest(w http.ResponseWriter, r *http.Request) {
	requestID := r.PathValue("request_id")
	var req struct {
		AdminID string `json:"admin_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.memberSvc.RejectRequest(requestID, req.AdminID); err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "rejected"})
}

func (h *MemberHandler) ListPendingRequests(w http.ResponseWriter, r *http.Request) {
	chatroomID := r.PathValue("id")
	adminID := r.URL.Query().Get("admin_id")
	if adminID == "" {
		writeError(w, http.StatusBadRequest, "admin_id query param required")
		return
	}
	requests, err := h.memberSvc.ListPendingRequests(chatroomID, adminID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, requests)
}
