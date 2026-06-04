package handler

import (
	"chatroom/service"
	"encoding/json"
	"net/http"
)

type StatusHandler struct {
	statusSvc *service.StatusService
}

func NewStatusHandler(ss *service.StatusService) *StatusHandler {
	return &StatusHandler{statusSvc: ss}
}

func (h *StatusHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" {
		writeError(w, http.StatusBadRequest, "username is required")
		return
	}
	userID := service.NewUserID()
	u := h.statusSvc.Register(userID, req.Username)
	writeJSON(w, http.StatusCreated, u)
}

func (h *StatusHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	var err error
	switch req.Status {
	case "online":
		err = h.statusSvc.SetOnline(userID)
	case "away":
		err = h.statusSvc.SetAway(userID)
	case "offline":
		err = h.statusSvc.SetOffline(userID)
	default:
		writeError(w, http.StatusBadRequest, "invalid status, must be online/away/offline")
		return
	}
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

func (h *StatusHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	u, err := h.statusSvc.GetUser(userID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (h *StatusHandler) GetUserChatrooms(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	chatrooms := h.statusSvc.GetUserChatrooms(userID)
	writeJSON(w, http.StatusOK, chatrooms)
}
