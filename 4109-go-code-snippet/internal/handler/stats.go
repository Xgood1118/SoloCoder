package handler

import (
	"net/http"

	"snippet-manager/internal/middleware"
	"snippet-manager/internal/model"
	"snippet-manager/pkg/utils"
)

func (h *Handler) GetLanguageStats(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	stats, err := h.svc.GetLanguageStats(teamID, user)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.JSONSuccess(w, stats)
}

func (h *Handler) GetSupportedLanguages(w http.ResponseWriter, r *http.Request) {
	utils.JSONSuccess(w, model.SupportedLanguages)
}
