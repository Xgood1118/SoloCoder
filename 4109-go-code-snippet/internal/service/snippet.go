package service

import (
	"errors"
	"strings"
	"time"

	"snippet-manager/internal/model"
	"snippet-manager/pkg/search"
	"snippet-manager/pkg/utils"
)

func (s *Service) GetSnippetByID(id uint) (*model.Snippet, error) {
	var snippet model.Snippet
	err := s.db.DB.Preload("Tags").Preload("Creator").
		First(&snippet, id).Error
	return &snippet, err
}

func (s *Service) GetSnippetDetail(id uint, user *model.User, teamID uint) (*model.Snippet, error) {
	snippet, err := s.GetSnippetByID(id)
	if err != nil {
		return nil, err
	}

	if !s.canViewSnippet(snippet, user, teamID) {
		return nil, errors.New("permission denied")
	}

	return snippet, nil
}

func (s *Service) CreateSnippet(teamID uint, user *model.User, req *SnippetCreateRequest) (*model.Snippet, error) {
	if user == nil {
		return nil, errors.New("user not authenticated")
	}

	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	if req.Language == "" {
		return nil, errors.New("language is required")
	}
	if req.Code == "" {
		return nil, errors.New("code is required")
	}

	if err := utils.ValidateLanguage(req.Language); err != nil {
		return nil, err
	}

	var count int64
	s.db.DB.Model(&model.Snippet{}).
		Where("team_id = ? AND title = ?", teamID, req.Title).
		Count(&count)
	if count > 0 {
		return nil, errors.New("snippet with same title already exists in this team")
	}

	req.Code = utils.TruncateCode(req.Code, s.cfg.MaxCodeLength)

	visibility := model.SnippetVisibility(req.Visibility)
	if visibility != model.VisibilityPublic && visibility != model.VisibilityPrivate {
		visibility = model.VisibilityPrivate
	}

	libraryType := model.LibraryType(req.LibraryType)
	if libraryType != model.LibraryPublic && libraryType != model.LibraryPrivate {
		libraryType = model.LibraryPublic
	}

	snippet := &model.Snippet{
		TeamID:      teamID,
		CreatorID:   user.ID,
		Title:       req.Title,
		Language:    req.Language,
		Code:        req.Code,
		Visibility:  visibility,
		LibraryType: libraryType,
		IsPublic:    req.IsPublic,
	}

	tx := s.db.DB.Begin()

	if err := tx.Create(snippet).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if len(req.Tags) > 0 {
		tags, err := s.getOrCreateTags(tx, req.Tags)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Model(snippet).Association("Tags").Replace(tags); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	version := &model.SnippetVersion{
		SnippetID:  snippet.ID,
		Version:    1,
		Code:       snippet.Code,
		ModifierID: user.ID,
	}
	if err := tx.Create(version).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	return s.GetSnippetByID(snippet.ID)
}

func (s *Service) UpdateSnippet(id uint, user *model.User, teamID uint, req *SnippetUpdateRequest) (*model.Snippet, error) {
	snippet, err := s.GetSnippetByID(id)
	if err != nil {
		return nil, err
	}

	if snippet.TeamID != teamID {
		return nil, errors.New("snippet does not belong to this team")
	}

	if !s.canModifySnippet(snippet, user) {
		return nil, errors.New("permission denied")
	}

	tx := s.db.DB.Begin()

	updates := make(map[string]interface{})
	codeChanged := false

	if req.Title != "" && req.Title != snippet.Title {
		var count int64
		tx.Model(&model.Snippet{}).
			Where("team_id = ? AND title = ? AND id != ?", teamID, req.Title, id).
			Count(&count)
		if count > 0 {
			tx.Rollback()
			return nil, errors.New("snippet with same title already exists in this team")
		}
		updates["title"] = req.Title
	}

	if req.Language != "" && req.Language != snippet.Language {
		if err := utils.ValidateLanguage(req.Language); err != nil {
			tx.Rollback()
			return nil, err
		}
		updates["language"] = req.Language
	}

	if req.Code != "" && req.Code != snippet.Code {
		req.Code = utils.TruncateCode(req.Code, s.cfg.MaxCodeLength)
		updates["code"] = req.Code
		codeChanged = true
	}

	if req.Visibility != "" {
		visibility := model.SnippetVisibility(req.Visibility)
		if visibility == model.VisibilityPublic || visibility == model.VisibilityPrivate {
			updates["visibility"] = visibility
		}
	}

	if req.LibraryType != "" {
		libraryType := model.LibraryType(req.LibraryType)
		if libraryType == model.LibraryPublic || libraryType == model.LibraryPrivate {
			updates["library_type"] = libraryType
		}
	}

	if req.IsPublic != nil {
		updates["is_public"] = *req.IsPublic
	}

	if len(updates) > 0 {
		updates["updated_at"] = time.Now()
		if err := tx.Model(snippet).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if len(req.Tags) > 0 {
		tags, err := s.getOrCreateTags(tx, req.Tags)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Model(snippet).Association("Tags").Replace(tags); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if codeChanged {
		var maxVersion int
		tx.Model(&model.SnippetVersion{}).
			Where("snippet_id = ?", id).
			Select("COALESCE(MAX(version), 0)").
			Scan(&maxVersion)

		version := &model.SnippetVersion{
			SnippetID:  id,
			Version:    maxVersion + 1,
			Code:       req.Code,
			ModifierID: user.ID,
		}
		if err := tx.Create(version).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	tx.Commit()

	return s.GetSnippetByID(id)
}

func (s *Service) DeleteSnippet(id uint, user *model.User, teamID uint) error {
	snippet, err := s.GetSnippetByID(id)
	if err != nil {
		return err
	}

	if snippet.TeamID != teamID {
		return errors.New("snippet does not belong to this team")
	}

	if !s.canModifySnippet(snippet, user) {
		return errors.New("permission denied")
	}

	tx := s.db.DB.Begin()

	if err := tx.Model(snippet).Association("Tags").Clear(); err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Where("snippet_id = ?", id).Delete(&model.SnippetVersion{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Where("snippet_id = ?", id).Delete(&model.Comment{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Where("snippet_id = ?", id).Delete(&model.Favorite{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Where("source_id = ? OR target_id = ?", id, id).Delete(&model.SnippetReference{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Delete(snippet).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()
	return nil
}

func (s *Service) ListSnippets(teamID uint, user *model.User, page, pageSize int, sortBy string) (*model.PaginatedResponse, error) {
	var snippets []*model.Snippet
	var total int64

	query := s.db.DB.Model(&model.Snippet{}).
		Preload("Tags").Preload("Creator").
		Where("team_id = ?", teamID)

	if user == nil {
		query = query.Where("is_public = ?", true)
	} else if !s.isAdmin(user) {
		query = query.Where("(is_public = ? OR library_type = ? OR creator_id = ?)",
			true, model.LibraryPublic, user.ID)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize

	switch sortBy {
	case "hot", "references":
		query = query.Order("reference_count DESC, created_at DESC")
	default:
		query = query.Order("created_at DESC")
	}

	if err := query.Offset(offset).Limit(pageSize).Find(&snippets).Error; err != nil {
		return nil, err
	}

	previews := s.ToSnippetPreviews(snippets)
	return utils.NewPaginatedResponse(previews, total, page, pageSize), nil
}

func (s *Service) SearchSnippets(teamID uint, user *model.User, keyword string, page, pageSize int) (*model.PaginatedResponse, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return s.ListSnippets(teamID, user, page, pageSize, "created_at")
	}

	var allSnippets []*model.Snippet
	query := s.db.DB.Model(&model.Snippet{}).
		Preload("Tags").Preload("Creator").
		Where("team_id = ?", teamID)

	if user == nil {
		query = query.Where("is_public = ?", true)
	} else if !s.isAdmin(user) {
		query = query.Where("(is_public = ? OR library_type = ? OR creator_id = ?)",
			true, model.LibraryPublic, user.ID)
	}

	if err := query.Find(&allSnippets).Error; err != nil {
		return nil, err
	}

	searchable := make([]search.FuzzySearchable, len(allSnippets))
	for i, snip := range allSnippets {
		searchable[i] = &snippetSearchable{Snippet: snip}
	}

	results := search.FuzzySearch(keyword, searchable)

	idMap := make(map[uint]float64)
	for _, r := range results {
		idMap[r.ID] = r.Relevance
	}

	ids := make([]uint, len(results))
	for i, r := range results {
		ids[i] = r.ID
	}

	var snippets []*model.Snippet
	if len(ids) > 0 {
		if err := s.db.DB.Preload("Tags").Preload("Creator").
			Where("id IN ?", ids).
			Find(&snippets).Error; err != nil {
			return nil, err
		}

		ordered := make([]*model.Snippet, len(ids))
		snippetMap := make(map[uint]*model.Snippet)
		for _, snip := range snippets {
			snippetMap[snip.ID] = snip
		}
		for i, id := range ids {
			ordered[i] = snippetMap[id]
		}
		snippets = ordered
	}

	total := int64(len(results))
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(snippets) {
		snippets = []*model.Snippet{}
	} else if end > len(snippets) {
		snippets = snippets[start:]
	} else {
		snippets = snippets[start:end]
	}

	previews := s.ToSnippetPreviews(snippets)
	return utils.NewPaginatedResponse(previews, total, page, pageSize), nil
}

func (s *Service) ToSnippetPreviews(snippets []*model.Snippet) []*model.SnippetPreview {
	previews := make([]*model.SnippetPreview, len(snippets))
	for i, snip := range snippets {
		previews[i] = &model.SnippetPreview{
			ID:             snip.ID,
			Title:          snip.Title,
			Language:       snip.Language,
			CodePreview:    search.GetCodePreview(snip.Code, 20),
			Tags:           snip.Tags,
			Visibility:     snip.Visibility,
			LibraryType:    snip.LibraryType,
			IsPublic:       snip.IsPublic,
			ReferenceCount: snip.ReferenceCount,
			CreatorID:      snip.CreatorID,
			CreatedAt:      snip.CreatedAt,
			UpdatedAt:      snip.UpdatedAt,
		}
	}
	return previews
}

type snippetSearchable struct {
	*model.Snippet
}

func (s *snippetSearchable) GetID() uint {
	return s.Snippet.ID
}

func (s *snippetSearchable) GetTitle() string {
	return s.Snippet.Title
}

func (s *snippetSearchable) GetTags() []string {
	tags := make([]string, len(s.Snippet.Tags))
	for i, t := range s.Snippet.Tags {
		tags[i] = t.Name
	}
	return tags
}

func (s *snippetSearchable) GetCode() string {
	return s.Snippet.Code
}
