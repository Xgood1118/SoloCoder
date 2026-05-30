package service

import (
	"errors"
	"time"

	"snippet-manager/internal/model"
)

func (s *Service) GetSnippetVersions(snippetID uint, user *model.User, teamID uint) ([]*model.SnippetVersion, error) {
	snippet, err := s.GetSnippetByID(snippetID)
	if err != nil {
		return nil, err
	}

	if snippet.TeamID != teamID {
		return nil, errors.New("snippet does not belong to this team")
	}

	if !s.canViewSnippet(snippet, user, teamID) {
		return nil, errors.New("permission denied")
	}

	var versions []*model.SnippetVersion
	err = s.db.DB.Preload("Modifier").
		Where("snippet_id = ?", snippetID).
		Order("version DESC").
		Find(&versions).Error

	return versions, err
}

func (s *Service) GetSnippetVersion(snippetID uint, version int, user *model.User, teamID uint) (*model.SnippetVersion, error) {
	snippet, err := s.GetSnippetByID(snippetID)
	if err != nil {
		return nil, err
	}

	if snippet.TeamID != teamID {
		return nil, errors.New("snippet does not belong to this team")
	}

	if !s.canViewSnippet(snippet, user, teamID) {
		return nil, errors.New("permission denied")
	}

	var ver model.SnippetVersion
	err = s.db.DB.Preload("Modifier").
		Where("snippet_id = ? AND version = ?", snippetID, version).
		First(&ver).Error

	return &ver, err
}

func (s *Service) RestoreVersion(snippetID uint, version int, user *model.User, teamID uint) (*model.Snippet, error) {
	snippet, err := s.GetSnippetByID(snippetID)
	if err != nil {
		return nil, err
	}

	if snippet.TeamID != teamID {
		return nil, errors.New("snippet does not belong to this team")
	}

	if !s.canModifySnippet(snippet, user) {
		return nil, errors.New("permission denied")
	}

	var ver model.SnippetVersion
	err = s.db.DB.Where("snippet_id = ? AND version = ?", snippetID, version).
		First(&ver).Error
	if err != nil {
		return nil, err
	}

	tx := s.db.DB.Begin()

	var maxVersion int
	tx.Model(&model.SnippetVersion{}).
		Where("snippet_id = ?", snippetID).
		Select("COALESCE(MAX(version), 0)").
		Scan(&maxVersion)

	newVersion := &model.SnippetVersion{
		SnippetID:  snippetID,
		Version:    maxVersion + 1,
		Code:       ver.Code,
		ModifierID: user.ID,
	}
	if err := tx.Create(newVersion).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Model(snippet).Updates(map[string]interface{}{
		"code":       ver.Code,
		"updated_at": time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	return s.GetSnippetByID(snippetID)
}
