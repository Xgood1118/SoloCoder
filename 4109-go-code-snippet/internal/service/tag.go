package service

import (
	"strings"

	"snippet-manager/internal/model"
	"snippet-manager/pkg/utils"

	"gorm.io/gorm"
)

func (s *Service) getOrCreateTags(tx *gorm.DB, tagNames []string) ([]*model.Tag, error) {
	var tags []*model.Tag
	for _, name := range tagNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		var tag model.Tag
		err := tx.Where("name = ?", name).First(&tag).Error
		if err == gorm.ErrRecordNotFound {
			tag = model.Tag{Name: name}
			if err := tx.Create(&tag).Error; err != nil {
				return nil, err
			}
		} else if err != nil {
			return nil, err
		}
		tags = append(tags, &tag)
	}
	return tags, nil
}

func (s *Service) GetAllTags() ([]*model.Tag, error) {
	var tags []*model.Tag
	err := s.db.DB.Find(&tags).Error
	return tags, err
}

func (s *Service) GetSnippetsByTag(teamID uint, user *model.User, tagName string, page, pageSize int) (*model.PaginatedResponse, error) {
	var snippets []*model.Snippet
	var total int64

	query := s.db.DB.Model(&model.Snippet{}).
		Preload("Tags").Preload("Creator").
		Joins("JOIN snippet_tags ON snippet_tags.snippet_id = snippets.id").
		Joins("JOIN tags ON tags.id = snippet_tags.tag_id").
		Where("snippets.team_id = ? AND tags.name = ?", teamID, tagName)

	if user == nil {
		query = query.Where("snippets.is_public = ?", true)
	} else if !s.isAdmin(user) {
		query = query.Where("(snippets.is_public = ? OR snippets.library_type = ? OR snippets.creator_id = ?)",
			true, model.LibraryPublic, user.ID)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("snippets.created_at DESC").Find(&snippets).Error; err != nil {
		return nil, err
	}

	previews := s.ToSnippetPreviews(snippets)
	return utils.NewPaginatedResponse(previews, total, page, pageSize), nil
}
