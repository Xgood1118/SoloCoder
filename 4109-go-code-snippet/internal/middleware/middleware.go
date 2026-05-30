package middleware

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"snippet-manager/internal/model"
	"snippet-manager/internal/repository"
	"snippet-manager/pkg/utils"
)

type Middleware struct {
	db *repository.Database
}

func NewMiddleware(db *repository.Database) *Middleware {
	return &Middleware{db: db}
}

func (m *Middleware) CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func (m *Middleware) Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userIDStr := r.Header.Get("X-User-ID")
		if userIDStr == "" {
			next.ServeHTTP(w, r)
			return
		}

		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			utils.JSONError(w, http.StatusUnauthorized, "invalid user ID")
			return
		}

		var user model.User
		if err := m.db.DB.First(&user, uint(userID)).Error; err != nil {
			utils.JSONError(w, http.StatusUnauthorized, "user not found")
			return
		}

		r = utils.SetCurrentUser(r, &user)
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := utils.GetCurrentUser(r.Context())
		if user == nil {
			utils.JSONError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := utils.GetCurrentUser(r.Context())
		if user == nil {
			utils.JSONError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if user.Role != model.RoleAdmin {
			utils.JSONError(w, http.StatusForbidden, "admin required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) TeamID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		parts := strings.Split(path, "/")

		var teamIDStr string
		for i, part := range parts {
			if part == "teams" && i+1 < len(parts) {
				teamIDStr = parts[i+1]
				break
			}
		}

		if teamIDStr == "" {
			teamIDStr = r.URL.Query().Get("team_id")
		}

		if teamIDStr == "" {
			teamIDStr = "1"
		}

		teamID, err := strconv.ParseUint(teamIDStr, 10, 32)
		if err != nil {
			utils.JSONError(w, http.StatusBadRequest, "invalid team ID")
			return
		}

		ctx := context.WithValue(r.Context(), "team_id", uint(teamID))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetTeamID(r *http.Request) uint {
	teamID, ok := r.Context().Value("team_id").(uint)
	if !ok {
		return 1
	}
	return teamID
}
