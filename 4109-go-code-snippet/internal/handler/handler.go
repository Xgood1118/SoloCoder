package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"snippet-manager/internal/config"
	"snippet-manager/internal/service"
)

type Handler struct {
	cfg *config.Config
	svc *service.Service
}

func NewHandler(cfg *config.Config, svc *service.Service) *Handler {
	return &Handler{cfg: cfg, svc: svc}
}

func parseID(path string, prefix string) (uint, error) {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if part == prefix && i+1 < len(parts) {
			id, err := strconv.ParseUint(parts[i+1], 10, 32)
			if err != nil {
				return 0, err
			}
			return uint(id), nil
		}
	}
	return 0, nil
}

func parseBody(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func parseVersion(path string) (int, error) {
	parts := strings.Split(path, "/")
	for i := len(parts) - 1; i >= 0; i-- {
		if parts[i] == "versions" && i+1 < len(parts) {
			versionPart := parts[i+1]
			if versionPart == "" {
				continue
			}
			// Skip the /restore suffix so /versions/1/restore returns 1, not "restore"
			if versionPart == "restore" {
				continue
			}
			return strconv.Atoi(versionPart)
		}
	}
	return 0, errors.New("version not found in path")
}
