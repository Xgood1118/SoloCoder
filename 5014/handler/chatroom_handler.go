package handler

import (
	"chatroom/hub"
	"chatroom/model"
	"chatroom/service"
	"encoding/json"
	"net/http"
)

type ChatroomHandler struct {
	chatroomSvc *service.ChatroomService
	memberSvc   *service.MemberService
	messageSvc  *service.MessageService
	statusSvc   *service.StatusService
	hub         *hub.Hub
}

func NewChatroomHandler(cs *service.ChatroomService, ms *service.MemberService, msgs *service.MessageService, ss *service.StatusService, h *hub.Hub) *ChatroomHandler {
	return &ChatroomHandler{
		chatroomSvc: cs,
		memberSvc:   ms,
		messageSvc:  msgs,
		statusSvc:   ss,
		hub:         h,
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *ChatroomHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Type        string `json:"type"`
		CreatorID   string `json:"creator_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.CreatorID == "" {
		writeError(w, http.StatusBadRequest, "name and creator_id are required")
		return
	}

	chatroomType := model.ChatroomOpen
	if req.Type == "closed" {
		chatroomType = model.ChatroomClosed
	}

	cr, err := h.chatroomSvc.Create(service.CreateChatroomReq{
		Name:        req.Name,
		Description: req.Description,
		Type:        chatroomType,
		CreatorID:   req.CreatorID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, cr)
}

func (h *ChatroomHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cr, err := h.chatroomSvc.Get(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, cr)
}

func (h *ChatroomHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req service.UpdateChatroomReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	operatorID := r.URL.Query().Get("user_id")
	if operatorID == "" {
		writeError(w, http.StatusBadRequest, "user_id query param required")
		return
	}
	cr, err := h.chatroomSvc.Update(id, operatorID, req)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, cr)
}

func (h *ChatroomHandler) Shutdown(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	operatorID := r.URL.Query().Get("user_id")
	if operatorID == "" {
		writeError(w, http.StatusBadRequest, "user_id query param required")
		return
	}
	if err := h.chatroomSvc.Shutdown(id, operatorID); err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrNotAdmin {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "shutdown"})
}
