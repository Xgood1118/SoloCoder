package service

import (
	"errors"

	"snippet-manager/internal/model"
	"snippet-manager/pkg/utils"
)

func (s *Service) GetFavorites(user *model.User, teamID uint, page, pageSize int) (*model.PaginatedResponse, error) {
	if user == nil {
		return nil, errors.New("user not authenticated")
	}

	var favorites []*model.Favorite
	var total int64

	query := s.db.DB.Model(&model.Favorite{}).
		Preload("Snippet.Tags").
		Joins("JOIN snippets ON snippets.id = favorites.snippet_id").
		Where("favorites.user_id = ? AND snippets.team_id = ?", user.ID, teamID)

	if !s.isAdmin(user) {
		query = query.Where("(snippets.is_public = ? OR snippets.library_type = ? OR snippets.creator_id = ?)",
			true, model.LibraryPublic, user.ID)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).
		Order("favorites.created_at DESC").
		Find(&favorites).Error; err != nil {
		return nil, err
	}

	snippets := make([]*model.Snippet, len(favorites))
	for i, f := range favorites {
		snippets[i] = f.Snippet
	}

	previews := s.ToSnippetPreviews(snippets)
	return utils.NewPaginatedResponse(previews, total, page, pageSize), nil
}

func (s *Service) AddFavorite(user *model.User, teamID uint, snippetID uint) error {
	if user == nil {
		return errors.New("user not authenticated")
	}

	snippet, err := s.GetSnippetByID(snippetID)
	if err != nil {
		return err
	}

	if snippet.TeamID != teamID {
		return errors.New("snippet does not belong to this team")
	}

	if !s.canViewSnippet(snippet, user, teamID) {
		return errors.New("permission denied")
	}

	var count int64
	s.db.DB.Model(&model.Favorite{}).
		Where("user_id = ? AND snippet_id = ?", user.ID, snippetID).
		Count(&count)
	if count > 0 {
		return errors.New("already favorited")
	}

	favorite := &model.Favorite{
		UserID:    user.ID,
		SnippetID: snippetID,
	}

	return s.db.DB.Create(favorite).Error
}

func (s *Service) RemoveFavorite(user *model.User, teamID uint, snippetID uint) error {
	if user == nil {
		return errors.New("user not authenticated")
	}

	return s.db.DB.Where("user_id = ? AND snippet_id = ?", user.ID, snippetID).
		Delete(&model.Favorite{}).Error
}

func (s *Service) IsFavorite(user *model.User, snippetID uint) (bool, error) {
	if user == nil {
		return false, nil
	}

	var count int64
	err := s.db.DB.Model(&model.Favorite{}).
		Where("user_id = ? AND snippet_id = ?", user.ID, snippetID).
		Count(&count).Error

	return count > 0, err
}
