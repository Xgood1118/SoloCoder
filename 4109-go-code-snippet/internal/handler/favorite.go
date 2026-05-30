package handler

import (
	"net/http"
	"strings"

	"snippet-manager/internal/middleware"
	"snippet-manager/pkg/utils"
)

func (h *Handler) GetFavorites(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	page, pageSize := utils.GetPaginationParams(r, h.cfg)

	result, err := h.svc.GetFavorites(user, teamID, page, pageSize)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, result)
}

func (h *Handler) AddFavorite(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	if err := h.svc.AddFavorite(user, teamID, snippetID); err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]string{"status": "favorited"})
}

func (h *Handler) RemoveFavorite(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	if err := h.svc.RemoveFavorite(user, teamID, snippetID); err != nil {
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]string{"status": "unfavorited"})
}

func (h *Handler) IsFavorite(w http.ResponseWriter, r *http.Request) {
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	isFav, err := h.svc.IsFavorite(user, snippetID)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]bool{"is_favorite": isFav})
}
