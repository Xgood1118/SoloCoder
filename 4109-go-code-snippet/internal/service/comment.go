package service

import (
	"errors"

	"snippet-manager/internal/model"
)

func (s *Service) GetComments(snippetID uint, user *model.User, teamID uint) ([]*model.Comment, error) {
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

	var comments []*model.Comment
	err = s.db.DB.Preload("Author").
		Where("snippet_id = ?", snippetID).
		Order("created_at ASC").
		Find(&comments).Error

	return comments, err
}

func (s *Service) AddComment(snippetID uint, user *model.User, teamID uint, content string) (*model.Comment, error) {
	if user == nil {
		return nil, errors.New("user not authenticated")
	}

	if content == "" {
		return nil, errors.New("comment content is required")
	}

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

	comment := &model.Comment{
		SnippetID: snippetID,
		AuthorID:  user.ID,
		Content:   content,
	}

	if err := s.db.DB.Create(comment).Error; err != nil {
		return nil, err
	}

	return s.GetComment(comment.ID)
}

func (s *Service) GetComment(id uint) (*model.Comment, error) {
	var comment model.Comment
	err := s.db.DB.Preload("Author").First(&comment, id).Error
	return &comment, err
}

func (s *Service) DeleteComment(commentID uint, user *model.User, teamID uint) error {
	if user == nil {
		return errors.New("user not authenticated")
	}

	var comment model.Comment
	if err := s.db.DB.First(&comment, commentID).Error; err != nil {
		return err
	}

	var snippet model.Snippet
	if err := s.db.DB.First(&snippet, comment.SnippetID).Error; err != nil {
		return err
	}

	if snippet.TeamID != teamID {
		return errors.New("snippet does not belong to this team")
	}

	if !s.isAdmin(user) && comment.AuthorID != user.ID {
		return errors.New("permission denied")
	}

	return s.db.DB.Delete(&comment).Error
}
