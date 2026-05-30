package handler

import (
	"io"
	"net/http"
	"time"

	"snippet-manager/internal/middleware"
	"snippet-manager/pkg/utils"
)

func (h *Handler) ExportJSON(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	data, err := h.svc.ExportSnippetsJSON(teamID, user)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=snippets_"+time.Now().Format("20060102")+".json")
	w.Write(data)
}

func (h *Handler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=snippets_"+time.Now().Format("20060102")+".csv")

	if err := h.svc.ExportSnippetsCSV(teamID, user, w); err != nil {
		utils.JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (h *Handler) ImportJSON(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	data, err := io.ReadAll(r.Body)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	count, err := h.svc.ImportSnippetsJSON(teamID, user, data)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]interface{}{
		"imported": count,
		"status":   "success",
	})
}

func (h *Handler) ImportCSV(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	count, err := h.svc.ImportSnippetsCSV(teamID, user, r.Body)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]interface{}{
		"imported": count,
		"status":   "success",
	})
}
