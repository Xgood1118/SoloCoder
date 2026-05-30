package service

import (
	"errors"

	"snippet-manager/internal/model"
)

func (s *Service) BatchUpdateTags(user *model.User, teamID uint, req *BatchTagRequest) (int, error) {
	if user == nil {
		return 0, errors.New("user not authenticated")
	}

	if len(req.SnippetIDs) == 0 {
		return 0, errors.New("no snippet IDs provided")
	}

	if len(req.Tags) == 0 && !req.Replace {
		return 0, errors.New("no tags provided")
	}

	tx := s.db.DB.Begin()

	newTags, err := s.getOrCreateTags(tx, req.Tags)
	if err != nil {
		tx.Rollback()
		return 0, err
	}

	count := 0
	for _, id := range req.SnippetIDs {
		var snippet model.Snippet
		if err := tx.First(&snippet, id).Error; err != nil {
			continue
		}

		if snippet.TeamID != teamID {
			continue
		}

		if !s.canModifySnippet(&snippet, user) {
			continue
		}

		if req.Replace {
			if len(req.Tags) == 0 {
				if err := tx.Model(&snippet).Association("Tags").Clear(); err != nil {
					continue
				}
			} else {
				if err := tx.Model(&snippet).Association("Tags").Replace(newTags); err != nil {
					continue
				}
			}
		} else {
			for _, tag := range newTags {
				if err := tx.Model(&snippet).Association("Tags").Append(tag); err != nil {
					continue
				}
			}
		}
		count++
	}

	tx.Commit()
	return count, nil
}

func (s *Service) BatchDelete(user *model.User, teamID uint, req *BatchDeleteRequest) (int, error) {
	if user == nil {
		return 0, errors.New("user not authenticated")
	}

	if len(req.SnippetIDs) == 0 {
		return 0, errors.New("no snippet IDs provided")
	}

	if !req.Confirmed {
		return 0, errors.New("batch delete requires confirmation")
	}

	tx := s.db.DB.Begin()

	count := 0
	for _, id := range req.SnippetIDs {
		var snippet model.Snippet
		if err := tx.First(&snippet, id).Error; err != nil {
			continue
		}

		if snippet.TeamID != teamID {
			continue
		}

		if !s.canModifySnippet(&snippet, user) {
			continue
		}

		if err := tx.Model(&snippet).Association("Tags").Clear(); err != nil {
			tx.Rollback()
			return 0, err
		}

		if err := tx.Where("snippet_id = ?", id).Delete(&model.SnippetVersion{}).Error; err != nil {
			tx.Rollback()
			return 0, err
		}

		if err := tx.Where("snippet_id = ?", id).Delete(&model.Comment{}).Error; err != nil {
			tx.Rollback()
			return 0, err
		}

		if err := tx.Where("snippet_id = ?", id).Delete(&model.Favorite{}).Error; err != nil {
			tx.Rollback()
			return 0, err
		}

		if err := tx.Where("source_id = ? OR target_id = ?", id, id).Delete(&model.SnippetReference{}).Error; err != nil {
			tx.Rollback()
			return 0, err
		}

		if err := tx.Delete(&snippet).Error; err != nil {
			tx.Rollback()
			return 0, err
		}

		count++
	}

	tx.Commit()
	return count, nil
}
