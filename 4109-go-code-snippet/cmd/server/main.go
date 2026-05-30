package main

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"snippet-manager/internal/config"
	"snippet-manager/internal/handler"
	"snippet-manager/internal/middleware"
	"snippet-manager/internal/repository"
	"snippet-manager/internal/service"
)

func main() {
	cfg := config.Load()

	db, err := repository.NewDatabase(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	svc := service.NewService(cfg, db)
	h := handler.NewHandler(cfg, svc)
	mw := middleware.NewMiddleware(db)

	api := http.NewServeMux()

	api.HandleFunc("/languages", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.GetSupportedLanguages(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/tags", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.GetAllTags(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/tags/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.GetSnippetsByTag(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/stats/languages", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.GetLanguageStats(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/snippets", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if r.URL.Query().Get("q") != "" {
				h.SearchSnippets(w, r)
			} else {
				h.ListSnippets(w, r)
			}
		case http.MethodPost:
			h.CreateSnippet(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/snippets/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if strings.HasSuffix(path, "/preview") {
			if r.Method == http.MethodGet {
				h.GetSnippetPreview(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.Contains(path, "/versions/") {
			if strings.HasSuffix(path, "/restore") {
				if r.Method == http.MethodPost {
					h.RestoreVersion(w, r)
				} else {
					http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				}
			} else {
				if r.Method == http.MethodGet {
					h.GetVersion(w, r)
				} else {
					http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				}
			}
			return
		}

		if strings.HasSuffix(path, "/versions") {
			if r.Method == http.MethodGet {
				h.GetVersions(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.HasSuffix(path, "/comments") {
			switch r.Method {
			case http.MethodGet:
				h.GetComments(w, r)
			case http.MethodPost:
				h.AddComment(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.HasSuffix(path, "/references") {
			switch r.Method {
			case http.MethodGet:
				h.GetReferences(w, r)
			case http.MethodPost:
				h.AddReference(w, r)
			case http.MethodDelete:
				h.RemoveReference(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.HasSuffix(path, "/favorite") {
			switch r.Method {
			case http.MethodGet:
				h.IsFavorite(w, r)
			case http.MethodPost:
				h.AddFavorite(w, r)
			case http.MethodDelete:
				h.RemoveFavorite(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		switch r.Method {
		case http.MethodGet:
			h.GetSnippet(w, r)
		case http.MethodPut, http.MethodPatch:
			h.UpdateSnippet(w, r)
		case http.MethodDelete:
			h.DeleteSnippet(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/favorites", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.GetFavorites(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/comments/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			h.DeleteComment(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/batch/tags", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			h.BatchUpdateTags(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/batch/delete", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodDelete {
			h.BatchDelete(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/export/json", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.ExportJSON(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/export/csv", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			h.ExportCSV(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/import/json", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.ImportJSON(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	api.HandleFunc("/import/csv", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.ImportCSV(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	root := http.NewServeMux()
	root.Handle("/api/", http.StripPrefix("/api", mw.TeamID(mw.Auth(mw.CORS(mw.Logger(api))))))

	root.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","port":%d}`, cfg.Port)
	})

	addr := ":" + strconv.Itoa(cfg.Port)
	log.Printf("Server starting on port %d...", cfg.Port)
	log.Printf("API prefix: /api")
	log.Printf("Health check: /api/health")
	if err := http.ListenAndServe(addr, root); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
