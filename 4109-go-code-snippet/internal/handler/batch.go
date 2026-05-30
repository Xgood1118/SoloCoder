package handler

import (
	"net/http"

	"snippet-manager/internal/middleware"
	"snippet-manager/internal/service"
	"snippet-manager/pkg/utils"
)

func (h *Handler) BatchUpdateTags(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	var req service.BatchTagRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	count, err := h.svc.BatchUpdateTags(user, teamID, &req)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]interface{}{
		"updated": count,
		"status":  "success",
	})
}

func (h *Handler) BatchDelete(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	var req service.BatchDeleteRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	count, err := h.svc.BatchDelete(user, teamID, &req)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]interface{}{
		"deleted": count,
		"status":  "success",
	})
}
