package service

import (
	"errors"
	"time"

	"auth-service/internal/cache"
	"auth-service/internal/config"
	"auth-service/internal/database"
	"auth-service/internal/model"
	"auth-service/internal/util"
)

type AuthService struct{}

func NewAuthService() *AuthService {
	return &AuthService{}
}

type LoginRequest struct {
	Account  string `json:"account"`
	Password string `json:"password"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"-"`
	User         *model.User `json:"user"`
}

func (s *AuthService) Login(req *LoginRequest, ip, userAgent string) (*LoginResponse, string, error) {
	userService := NewUserService()
	user, err := userService.GetUserByAccount(req.Account)
	if err != nil {
		return nil, "", errors.New("invalid account or password")
	}

	if !user.IsActive() {
		return nil, "", errors.New("account is disabled")
	}

	if !util.CheckPasswordHash(req.Password, user.PasswordHash) {
		s.recordLoginHistory(user.ID, ip, userAgent, model.LoginStatusFailed, "wrong password")
		return nil, "", errors.New("invalid account or password")
	}

	sessionID := util.GenerateSessionID()
	refreshToken, err := util.GenerateRefreshToken()
	if err != nil {
		return nil, "", errors.New("failed to generate refresh token")
	}

	permissions := user.GetPermissionCodes()
	accessToken, err := util.GenerateAccessToken(user, sessionID, permissions)
	if err != nil {
		return nil, "", errors.New("failed to generate access token")
	}

	if config.AppConfig.MultiDevice.Enabled {
		s.checkAndLimitSessions(user.ID)
	}

	expiresAt := time.Now().Add(time.Duration(config.AppConfig.JWT.RefreshTokenExpire) * time.Second)
	session := &model.Session{
		UserID:       user.ID,
		SessionID:    sessionID,
		RefreshToken: refreshToken,
		IPAddress:    ip,
		UserAgent:    userAgent,
		DeviceType:   s.getDeviceType(userAgent),
		LastActiveAt: time.Now(),
		ExpiresAt:    expiresAt,
		IsRevoked:    false,
	}
	if err := database.DB.Create(session).Error; err != nil {
		return nil, "", errors.New("failed to create session")
	}

	s.recordLoginHistory(user.ID, ip, userAgent, model.LoginStatusSuccess, "")

	return &LoginResponse{
		AccessToken:  accessToken,
		TokenType:    "Bearer",
		ExpiresIn:    config.AppConfig.JWT.AccessTokenExpire,
		RefreshToken: refreshToken,
		User:         user,
	}, sessionID, nil
}

func (s *AuthService) RefreshToken(refreshToken string) (*LoginResponse, string, error) {
	var session model.Session
	if err := database.DB.Where("refresh_token = ? AND is_revoked = ?", refreshToken, false).First(&session).Error; err != nil {
		return nil, "", errors.New("invalid refresh token")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, "", errors.New("refresh token expired")
	}

	userService := NewUserService()
	user, err := userService.GetUserByID(session.UserID)
	if err != nil {
		return nil, "", errors.New("user not found")
	}

	if !user.IsActive() {
		return nil, "", errors.New("account is disabled")
	}

	permissions := user.GetPermissionCodes()
	accessToken, err := util.GenerateAccessToken(user, session.SessionID, permissions)
	if err != nil {
		return nil, "", errors.New("failed to generate access token")
	}

	session.LastActiveAt = time.Now()
	database.DB.Save(&session)

	return &LoginResponse{
		AccessToken:  accessToken,
		TokenType:    "Bearer",
		ExpiresIn:    config.AppConfig.JWT.AccessTokenExpire,
		RefreshToken: refreshToken,
		User:         user,
	}, session.SessionID, nil
}

func (s *AuthService) Logout(sessionID string) error {
	result := database.DB.Model(&model.Session{}).
		Where("session_id = ?", sessionID).
		Update("is_revoked", true)
	if result.Error != nil {
		return result.Error
	}

	cache.Del(nil, "session:"+sessionID)
	return nil
}

func (s *AuthService) LogoutAll(userID uint) error {
	result := database.DB.Model(&model.Session{}).
		Where("user_id = ? AND is_revoked = ?", userID, false).
		Update("is_revoked", true)
	if result.Error != nil {
		return result.Error
	}

	cache.GetMemoryCache().DeleteByPattern("session:")
	return nil
}

func (s *AuthService) ValidateSession(sessionID string) bool {
	var session model.Session
	if err := database.DB.Where("session_id = ? AND is_revoked = ?", sessionID, false).First(&session).Error; err != nil {
		return false
	}
	return time.Now().Before(session.ExpiresAt)
}

func (s *AuthService) KickUser(userID uint) error {
	return s.LogoutAll(userID)
}

func (s *AuthService) checkAndLimitSessions(userID uint) {
	var activeSessions int64
	database.DB.Model(&model.Session{}).
		Where("user_id = ? AND is_revoked = ?", userID, false).
		Count(&activeSessions)

	if int(activeSessions) >= config.AppConfig.MultiDevice.MaxSessions {
		var oldestSession model.Session
		database.DB.Where("user_id = ? AND is_revoked = ?", userID, false).
			Order("created_at ASC").
			First(&oldestSession)
		oldestSession.IsRevoked = true
		database.DB.Save(&oldestSession)
	}
}

func (s *AuthService) getDeviceType(userAgent string) string {
	ua := userAgent
	if ua == "" {
		return "unknown"
	}
	if len(ua) > 50 {
		ua = ua[:50]
	}
	return ua
}

func (s *AuthService) recordLoginHistory(userID uint, ip, userAgent string, status int, reason string) {
	history := &model.LoginHistory{
		UserID:     userID,
		IPAddress:  ip,
		UserAgent:  userAgent,
		DeviceType: s.getDeviceType(userAgent),
		Status:     status,
		FailReason: reason,
	}
	database.DB.Create(history)
}
