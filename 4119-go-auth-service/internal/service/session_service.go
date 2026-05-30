package service

import (
	"errors"
	"time"

	"auth-service/internal/database"
	"auth-service/internal/model"
)

type SessionService struct{}

func NewSessionService() *SessionService {
	return &SessionService{}
}

type SessionInfo struct {
	ID           uint      `json:"id"`
	SessionID    string    `json:"session_id"`
	UserID       uint      `json:"user_id"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	DeviceType   string    `json:"device_type"`
	Location     string    `json:"location"`
	CreatedAt    time.Time `json:"created_at"`
	LastActiveAt time.Time `json:"last_active_at"`
	IsCurrent    bool      `json:"is_current"`
}

func (s *SessionService) GetUserSessions(userID uint) ([]SessionInfo, error) {
	var sessions []model.Session
	if err := database.DB.Where("user_id = ? AND is_revoked = ?", userID, false).Find(&sessions).Error; err != nil {
		return nil, err
	}

	result := make([]SessionInfo, len(sessions))
	for i, sess := range sessions {
		result[i] = SessionInfo{
			ID:           sess.ID,
			SessionID:    sess.SessionID,
			UserID:       sess.UserID,
			IPAddress:    sess.IPAddress,
			UserAgent:    sess.UserAgent,
			DeviceType:   sess.DeviceType,
			Location:     sess.Location,
			CreatedAt:    sess.CreatedAt,
			LastActiveAt: sess.LastActiveAt,
		}
	}

	return result, nil
}

func (s *SessionService) GetSessionByID(sessionID string) (*model.Session, error) {
	var session model.Session
	if err := database.DB.Where("session_id = ?", sessionID).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *SessionService) RevokeSession(userID uint, sessionID string) error {
	result := database.DB.Model(&model.Session{}).
		Where("user_id = ? AND session_id = ?", userID, sessionID).
		Update("is_revoked", true)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}
	return nil
}

func (s *SessionService) RevokeAllSessions(userID uint) error {
	return database.DB.Model(&model.Session{}).
		Where("user_id = ? AND is_revoked = ?", userID, false).
		Update("is_revoked", true).Error
}

func (s *SessionService) KickUser(userID uint, reason string) error {
	if err := s.RevokeAllSessions(userID); err != nil {
		return err
	}
	return nil
}

func (s *SessionService) GetLoginHistory(userID uint, page, pageSize int) ([]model.LoginHistory, int64, error) {
	var history []model.LoginHistory
	var total int64

	query := database.DB.Model(&model.LoginHistory{}).Where("user_id = ?", userID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&history).Error; err != nil {
		return nil, 0, err
	}

	return history, total, nil
}

func (s *SessionService) GetOnlineUsers() ([]uint, error) {
	var userIDs []uint
	threshold := time.Now().Add(-5 * time.Minute)

	err := database.DB.Model(&model.Session{}).
		Where("is_revoked = ? AND last_active_at > ?", false, threshold).
		Distinct("user_id").
		Pluck("user_id", &userIDs).Error

	return userIDs, err
}

func (s *SessionService) UpdateSessionActivity(sessionID string) error {
	return database.DB.Model(&model.Session{}).
		Where("session_id = ?", sessionID).
		Update("last_active_at", time.Now()).Error
}

func (s *SessionService) DetectAnomalyLogin(userID uint, ip string) bool {
	var recentLogins []model.LoginHistory
	threshold := time.Now().Add(-24 * time.Hour)

	database.DB.Where("user_id = ? AND created_at > ?", userID, threshold).
		Order("created_at DESC").
		Limit(10).
		Find(&recentLogins)

	ipMap := make(map[string]bool)
	for _, login := range recentLogins {
		if login.IPAddress != "" {
			ipMap[login.IPAddress] = true
		}
	}

	return len(ipMap) > 3
}
