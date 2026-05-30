package handler

import (
	"net/http"
	"strings"

	"snippet-manager/internal/middleware"
	"snippet-manager/internal/model"
	"snippet-manager/internal/service"
	"snippet-manager/pkg/utils"
)

func (h *Handler) ListSnippets(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	page, pageSize := utils.GetPaginationParams(r, h.cfg)
	sortBy := r.URL.Query().Get("sort")

	result, err := h.svc.ListSnippets(teamID, user, page, pageSize, sortBy)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, result)
}

func (h *Handler) SearchSnippets(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	keyword := r.URL.Query().Get("q")
	page, pageSize := utils.GetPaginationParams(r, h.cfg)

	result, err := h.svc.SearchSnippets(teamID, user, keyword, page, pageSize)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, result)
}

func (h *Handler) GetSnippet(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	id, err := parseID(r.URL.Path, "snippets")
	if err != nil || id == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	snippet, err := h.svc.GetSnippetDetail(id, user, teamID)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSONSuccess(w, snippet)
}

func (h *Handler) CreateSnippet(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	var req service.SnippetCreateRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	snippet, err := h.svc.CreateSnippet(teamID, user, &req)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONResponse(w, http.StatusCreated, snippet)
}

func (h *Handler) UpdateSnippet(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	id, err := parseID(r.URL.Path, "snippets")
	if err != nil || id == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	var req service.SnippetUpdateRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	snippet, err := h.svc.UpdateSnippet(id, user, teamID, &req)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, snippet)
}

func (h *Handler) DeleteSnippet(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	id, err := parseID(r.URL.Path, "snippets")
	if err != nil || id == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	if err := h.svc.DeleteSnippet(id, user, teamID); err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]string{"status": "deleted"})
}

func (h *Handler) GetSnippetPreview(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	id, err := parseID(r.URL.Path, "snippets")
	if err != nil || id == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	snippet, err := h.svc.GetSnippetDetail(id, user, teamID)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusNotFound, err.Error())
		return
	}

	previews := h.svc.ToSnippetPreviews([]*model.Snippet{snippet})
	if len(previews) > 0 {
		utils.JSONSuccess(w, previews[0])
	} else {
		utils.JSONError(w, http.StatusNotFound, "snippet not found")
	}
}
