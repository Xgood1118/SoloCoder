package handler

import (
	"net/http"
	"strings"

	"snippet-manager/internal/middleware"
	"snippet-manager/pkg/utils"
)

func (h *Handler) GetVersions(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	versions, err := h.svc.GetSnippetVersions(snippetID, user, teamID)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSONSuccess(w, versions)
}

func (h *Handler) GetVersion(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	versionNum, err := parseVersion(r.URL.Path)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid version number")
		return
	}

	version, err := h.svc.GetSnippetVersion(snippetID, versionNum, user, teamID)
	if err != nil {
		if strings.Contains(err.Error(), "permission denied") {
			utils.JSONError(w, http.StatusForbidden, err.Error())
			return
		}
		utils.JSONError(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSONSuccess(w, version)
}

func (h *Handler) RestoreVersion(w http.ResponseWriter, r *http.Request) {
	teamID := middleware.GetTeamID(r)
	user := utils.GetCurrentUser(r.Context())
	snippetID, err := parseID(r.URL.Path, "snippets")
	if err != nil || snippetID == 0 {
		utils.JSONError(w, http.StatusBadRequest, "invalid snippet ID")
		return
	}

	versionNum, err := parseVersion(r.URL.Path)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "invalid version number")
		return
	}

	snippet, err := h.svc.RestoreVersion(snippetID, versionNum, user, teamID)
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
