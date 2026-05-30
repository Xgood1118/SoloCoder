package service

import (
	"errors"
	"io"

	"snippet-manager/internal/model"
	"snippet-manager/pkg/utils"
)

func (s *Service) ExportSnippetsJSON(teamID uint, user *model.User) ([]byte, error) {
	snippets, err := s.getTeamSnippetsForExport(teamID, user)
	if err != nil {
		return nil, err
	}

	return utils.ExportSnippetsToJSON(snippets)
}

func (s *Service) ExportSnippetsCSV(teamID uint, user *model.User, w io.Writer) error {
	snippets, err := s.getTeamSnippetsForExport(teamID, user)
	if err != nil {
		return err
	}

	records, err := utils.ExportSnippetsToCSV(snippets)
	if err != nil {
		return err
	}

	return utils.WriteCSV(w, records)
}

func (s *Service) getTeamSnippetsForExport(teamID uint, user *model.User) ([]*model.Snippet, error) {
	var snippets []*model.Snippet

	query := s.db.DB.Model(&model.Snippet{}).
		Preload("Tags").Preload("Creator").
		Where("team_id = ?", teamID)

	if user == nil {
		query = query.Where("is_public = ?", true)
	} else if !s.isAdmin(user) {
		query = query.Where("(is_public = ? OR library_type = ? OR creator_id = ?)",
			true, model.LibraryPublic, user.ID)
	}

	if err := query.Order("created_at DESC").Find(&snippets).Error; err != nil {
		return nil, err
	}

	return snippets, nil
}

func (s *Service) ImportSnippetsJSON(teamID uint, user *model.User, data []byte) (int, error) {
	if user == nil {
		return 0, errors.New("user not authenticated")
	}

	imported, err := utils.ImportSnippetsFromJSON(data)
	if err != nil {
		return 0, err
	}

	return s.importSnippets(teamID, user, imported)
}

func (s *Service) ImportSnippetsCSV(teamID uint, user *model.User, r io.Reader) (int, error) {
	if user == nil {
		return 0, errors.New("user not authenticated")
	}

	imported, err := utils.ImportSnippetsFromCSV(r)
	if err != nil {
		return 0, err
	}

	return s.importSnippets(teamID, user, imported)
}

func (s *Service) importSnippets(teamID uint, user *model.User, imported []*model.Snippet) (int, error) {
	tx := s.db.DB.Begin()

	count := 0
	for _, snip := range imported {
		var countSame int64
		tx.Model(&model.Snippet{}).
			Where("team_id = ? AND title = ?", teamID, snip.Title).
			Count(&countSame)
		if countSame > 0 {
			continue
		}

		if err := utils.ValidateLanguage(snip.Language); err != nil {
			continue
		}

		snip.Code = utils.TruncateCode(snip.Code, s.cfg.MaxCodeLength)
		snip.TeamID = teamID
		snip.CreatorID = user.ID

		if snip.Visibility != model.VisibilityPublic && snip.Visibility != model.VisibilityPrivate {
			snip.Visibility = model.VisibilityPrivate
		}
		if snip.LibraryType != model.LibraryPublic && snip.LibraryType != model.LibraryPrivate {
			snip.LibraryType = model.LibraryPublic
		}

		tags := snip.Tags
		snip.Tags = nil

		if err := tx.Create(snip).Error; err != nil {
			continue
		}

		if len(tags) > 0 {
			tagNames := make([]string, len(tags))
			for i, t := range tags {
				tagNames[i] = t.Name
			}
			newTags, err := s.getOrCreateTags(tx, tagNames)
			if err == nil {
				tx.Model(snip).Association("Tags").Replace(newTags)
			}
		}

		version := &model.SnippetVersion{
			SnippetID:  snip.ID,
			Version:    1,
			Code:       snip.Code,
			ModifierID: user.ID,
		}
		tx.Create(version)

		count++
	}

	tx.Commit()
	return count, nil
}
