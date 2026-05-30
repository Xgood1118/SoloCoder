package handler

import (
	"net/http"
	"strings"

	"snippet-manager/internal/middleware"
	"snippet-manager/internal/service"
	"snippet-manager/pkg/utils"
)

func (h *Handler) GetReferences(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	referencedBy, references, err := h.svc.GetReferences(snippetID, user, teamID)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]interface{}{
		"referenced_by": referencedBy,
		"references":    references,
	})
}

func (h *Handler) AddReference(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	var req service.ReferenceRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.AddReference(user, teamID, req.SourceID, req.TargetID); err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]string{"status": "reference added"})
}

func (h *Handler) RemoveReference(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())

	var req service.ReferenceRequest
	if err := parseBody(r, &req); err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.RemoveReference(user, teamID, req.SourceID, req.TargetID); err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSONSuccess(w, map[string]string{"status": "reference removed"})
}
