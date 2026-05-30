package service

import (
	"snippet-manager/internal/config"
	"snippet-manager/internal/model"
	"snippet-manager/internal/repository"
)

type Service struct {
	cfg *config.Config
	db  *repository.Database
}

func NewService(cfg *config.Config, db *repository.Database) *Service {
	return &Service{
		cfg: cfg,
		db:  db,
	}
}

type SnippetCreateRequest struct {
	Title       string   `json:"title"`
	Language    string   `json:"language"`
	Code        string   `json:"code"`
	Tags        []string `json:"tags"`
	Visibility  string   `json:"visibility"`
	LibraryType string   `json:"library_type"`
	IsPublic    bool     `json:"is_public"`
}

type SnippetUpdateRequest struct {
	Title       string   `json:"title"`
	Language    string   `json:"language"`
	Code        string   `json:"code"`
	Tags        []string `json:"tags"`
	Visibility  string   `json:"visibility"`
	LibraryType string   `json:"library_type"`
	IsPublic    *bool    `json:"is_public"`
}

type BatchTagRequest struct {
	SnippetIDs []uint   `json:"snippet_ids"`
	Tags       []string `json:"tags"`
	Replace    bool     `json:"replace"`
}

type BatchDeleteRequest struct {
	SnippetIDs []uint `json:"snippet_ids"`
	Confirmed  bool   `json:"confirmed"`
}

type ReferenceRequest struct {
	SourceID uint `json:"source_id"`
	TargetID uint `json:"target_id"`
}

type CommentRequest struct {
	Content string `json:"content"`
}

func (s *Service) isAdmin(user *model.User) bool {
	return user != nil && user.Role == model.RoleAdmin
}

func (s *Service) canModifySnippet(snippet *model.Snippet, user *model.User) bool {
	if user == nil {
		return false
	}
	if s.isAdmin(user) {
		return true
	}
	return snippet.CreatorID == user.ID
}

func (s *Service) canViewSnippet(snippet *model.Snippet, user *model.User, teamID uint) bool {
	if snippet.IsPublic {
		return true
	}
	if user == nil {
		return false
	}
	if snippet.TeamID != teamID {
		return false
	}
	if s.isAdmin(user) {
		return true
	}
	if snippet.LibraryType == model.LibraryPublic {
		return true
	}
	return snippet.CreatorID == user.ID
}
