package service

import (
	"errors"

	"snippet-manager/internal/model"
)

func (s *Service) AddReference(user *model.User, teamID uint, sourceID, targetID uint) error {
	if user == nil {
		return errors.New("user not authenticated")
	}

	if sourceID == targetID {
		return errors.New("cannot reference self")
	}

	source, err := s.GetSnippetByID(sourceID)
	if err != nil {
		return err
	}

	target, err := s.GetSnippetByID(targetID)
	if err != nil {
		return err
	}

	if source.TeamID != teamID || target.TeamID != teamID {
		return errors.New("snippets do not belong to this team")
	}

	if !s.canModifySnippet(source, user) {
		return errors.New("permission denied: you can only add references from snippets you own")
	}

	if err := s.checkForCycle(sourceID, targetID); err != nil {
		return err
	}

	var count int64
	s.db.DB.Model(&model.SnippetReference{}).
		Where("source_id = ? AND target_id = ?", sourceID, targetID).
		Count(&count)
	if count > 0 {
		return errors.New("reference already exists")
	}

	tx := s.db.DB.Begin()

	ref := &model.SnippetReference{
		SourceID: sourceID,
		TargetID: targetID,
	}
	if err := tx.Create(ref).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(target).Update("reference_count", target.ReferenceCount+1).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()
	return nil
}

func (s *Service) RemoveReference(user *model.User, teamID uint, sourceID, targetID uint) error {
	if user == nil {
		return errors.New("user not authenticated")
	}

	source, err := s.GetSnippetByID(sourceID)
	if err != nil {
		return err
	}

	target, err := s.GetSnippetByID(targetID)
	if err != nil {
		return err
	}

	if source.TeamID != teamID {
		return errors.New("snippet does not belong to this team")
	}

	if !s.canModifySnippet(source, user) {
		return errors.New("permission denied")
	}

	tx := s.db.DB.Begin()

	if err := tx.Where("source_id = ? AND target_id = ?", sourceID, targetID).
		Delete(&model.SnippetReference{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if target.ReferenceCount > 0 {
		if err := tx.Model(target).Update("reference_count", target.ReferenceCount-1).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	tx.Commit()
	return nil
}

func (s *Service) GetReferences(snippetID uint, user *model.User, teamID uint) (referencedBy []*model.Snippet, references []*model.Snippet, err error) {
	snippet, err := s.GetSnippetByID(snippetID)
	if err != nil {
		return nil, nil, err
	}

	if snippet.TeamID != teamID {
		return nil, nil, errors.New("snippet does not belong to this team")
	}

	if !s.canViewSnippet(snippet, user, teamID) {
		return nil, nil, errors.New("permission denied")
	}

	var refRelations []*model.SnippetReference
	err = s.db.DB.Preload("Source").Preload("Target").
		Where("target_id = ?", snippetID).
		Find(&refRelations).Error
	if err != nil {
		return nil, nil, err
	}

	referencedBy = make([]*model.Snippet, 0, len(refRelations))
	for _, r := range refRelations {
		if r.Source != nil && s.canViewSnippet(r.Source, user, teamID) {
			referencedBy = append(referencedBy, r.Source)
		}
	}

	err = s.db.DB.Preload("Source").Preload("Target").
		Where("source_id = ?", snippetID).
		Find(&refRelations).Error
	if err != nil {
		return nil, nil, err
	}

	references = make([]*model.Snippet, 0, len(refRelations))
	for _, r := range refRelations {
		if r.Target != nil && s.canViewSnippet(r.Target, user, teamID) {
			references = append(references, r.Target)
		}
	}

	return referencedBy, references, nil
}

func (s *Service) checkForCycle(sourceID, targetID uint) error {
	visited := make(map[uint]bool)
	queue := []uint{targetID}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if current == sourceID {
			return errors.New("cannot create reference: cycle detected")
		}

		if visited[current] {
			continue
		}
		visited[current] = true

		var refs []*model.SnippetReference
		s.db.DB.Where("source_id = ?", current).Find(&refs)
		for _, r := range refs {
			if !visited[r.TargetID] {
				queue = append(queue, r.TargetID)
			}
		}
	}

	return nil
}
