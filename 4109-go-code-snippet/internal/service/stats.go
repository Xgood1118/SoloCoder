package service

import (
	"snippet-manager/internal/model"
)

func (s *Service) GetLanguageStats(teamID uint, user *model.User) ([]*model.LanguageStat, error) {
	var stats []*model.LanguageStat

	query := s.db.DB.Model(&model.Snippet{}).
		Select("language, COUNT(*) as count").
		Where("team_id = ?", teamID)

	if user == nil {
		query = query.Where("is_public = ?", true)
	} else if !s.isAdmin(user) {
		query = query.Where("(is_public = ? OR library_type = ? OR creator_id = ?)",
			true, model.LibraryPublic, user.ID)
	}

	err := query.Group("language").Order("count DESC").Scan(&stats).Error
	return stats, err
}
