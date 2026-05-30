package handler

import (
	"net/http"
	"strings"

	"snippet-manager/internal/middleware"
	"snippet-manager/internal/service"
	"snippet-manager/pkg/utils"
)

func (h *Handler) GetComments(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	comments, err := h.svc.GetComments(snippetID, user, teamID)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSONSuccess(w, comments)
}

func (h *Handler) AddComment(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	var req service.CommentRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	comment, err := h.svc.AddComment(snippetID, user, teamID, req.Content)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONResponse(w, http.StatusCreated, comment)
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	commentID, err := parseID(r.URL.Path, "comments")
	if err != nil || commentID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid comment ID")
		return
	}

	if err := h.svc.DeleteComment(commentID, user, teamID); err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]string{"status": "deleted"})
}
