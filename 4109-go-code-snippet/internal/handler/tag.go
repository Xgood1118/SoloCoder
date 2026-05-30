package handler

import (
	"net/http"
	"strings"

	"snippet-manager/internal/middleware"
	"snippet-manager/pkg/utils"
)

func (h *Handler) GetAllTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.svc.GetAllTags()
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, tags)
}

func (h *Handler) GetSnippetsByTag(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	tagName := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
	page, pageSize := utils.GetPaginationParams(r, h.cfg)

	result, err := h.svc.GetSnippetsByTag(teamID, user, tagName, page, pageSize)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, result)
}
