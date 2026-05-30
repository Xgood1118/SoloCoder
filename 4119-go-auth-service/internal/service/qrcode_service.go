package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"auth-service/internal/cache"
	"auth-service/internal/database"
	"auth-service/internal/model"
	"auth-service/internal/util"

	"github.com/gorilla/websocket"
)

type QRCodeService struct {
	connections map[string]*qrConn
	mu          sync.RWMutex
	stopCh      chan struct{}
}

type qrConn struct {
	conn      *websocket.Conn
	expiresAt time.Time
}

func NewQRCodeService() *QRCodeService {
	s := &QRCodeService{
		connections: make(map[string]*qrConn),
		stopCh:      make(chan struct{}),
	}
	go s.cleanupExpiredConnections()
	return s
}

const (
	qrCodeExpireTime = 5 * 60
	qrCodeCacheKey   = "qrcode:%s"
)

type QRCodeStatusMessage struct {
	QRCodeID string `json:"qr_code_id"`
	Status   int    `json:"status"`
	Token    string `json:"token,omitempty"`
}

func (s *QRCodeService) CreateQRCode() (string, error) {
	qrCodeID, err := util.GenerateRandomToken(32)
	if err != nil {
		return "", err
	}

	qrCode := &model.QRCodeLogin{
		QRCodeID:  qrCodeID,
		Status:    model.QRCodeStatusWaiting,
		ExpiresAt: time.Now().Add(qrCodeExpireTime * time.Second),
	}

	if err := database.DB.Create(qrCode).Error; err != nil {
		return "", err
	}

	cacheKey := fmt.Sprintf(qrCodeCacheKey, qrCodeID)
	cache.Set(nil, cacheKey, model.QRCodeStatusWaiting, qrCodeExpireTime*time.Second)

	return qrCodeID, nil
}

func (s *QRCodeService) GetQRCodeStatus(qrCodeID string) (int, error) {
	var qrCode model.QRCodeLogin
	if err := database.DB.Where("qr_code_id = ?", qrCodeID).First(&qrCode).Error; err != nil {
		return 0, errors.New("qr code not found")
	}

	if qrCode.IsExpired() {
		qrCode.Status = model.QRCodeStatusExpired
		database.DB.Save(&qrCode)
		return model.QRCodeStatusExpired, nil
	}

	return qrCode.Status, nil
}

func (s *QRCodeService) ScanQRCode(qrCodeID string, userID uint) error {
	var qrCode model.QRCodeLogin
	if err := database.DB.Where("qr_code_id = ?", qrCodeID).First(&qrCode).Error; err != nil {
		return errors.New("qr code not found")
	}

	if qrCode.IsExpired() {
		return errors.New("qr code expired")
	}

	if qrCode.Status != model.QRCodeStatusWaiting {
		return errors.New("qr code already scanned")
	}

	now := time.Now()
	qrCode.Status = model.QRCodeStatusScanned
	qrCode.UserID = &userID
	qrCode.ScannedAt = &now

	if err := database.DB.Save(&qrCode).Error; err != nil {
		return err
	}

	s.notifyStatusChange(qrCodeID, model.QRCodeStatusScanned, "")

	return nil
}

func (s *QRCodeService) ConfirmQRCode(qrCodeID string, userID uint, ip, userAgent string) (string, error) {
	var qrCode model.QRCodeLogin
	if err := database.DB.Where("qr_code_id = ?", qrCodeID).First(&qrCode).Error; err != nil {
		return "", errors.New("qr code not found")
	}

	if qrCode.IsExpired() {
		return "", errors.New("qr code expired")
	}

	if qrCode.Status != model.QRCodeStatusScanned {
		return "", errors.New("qr code not scanned yet")
	}

	if qrCode.UserID == nil || *qrCode.UserID != userID {
		return "", errors.New("invalid user")
	}

	user, err := NewUserService().GetUserByID(userID)
	if err != nil {
		return "", err
	}

	sessionID := util.GenerateSessionID()
	refreshToken, err := util.GenerateRefreshToken()
	if err != nil {
		return "", err
	}

	permissions := user.GetPermissionCodes()
	accessToken, err := util.GenerateAccessToken(user, sessionID, permissions)
	if err != nil {
		return "", err
	}

	now := time.Now()
	qrCode.Status = model.QRCodeStatusConfirmed
	qrCode.Token = accessToken
	qrCode.ConfirmedAt = &now

	if err := database.DB.Save(&qrCode).Error; err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	session := &model.Session{
		UserID:       userID,
		SessionID:    sessionID,
		RefreshToken: refreshToken,
		IPAddress:    ip,
		UserAgent:    userAgent,
		LastActiveAt: time.Now(),
		ExpiresAt:    expiresAt,
		IsRevoked:    false,
	}
	database.DB.Create(session)

	s.notifyStatusChange(qrCodeID, model.QRCodeStatusConfirmed, accessToken)

	return accessToken, nil
}

func (s *QRCodeService) CancelQRCode(qrCodeID string, userID uint) error {
	var qrCode model.QRCodeLogin
	if err := database.DB.Where("qr_code_id = ?", qrCodeID).First(&qrCode).Error; err != nil {
		return errors.New("qr code not found")
	}

	if qrCode.UserID == nil || *qrCode.UserID != userID {
		return errors.New("invalid user")
	}

	qrCode.Status = model.QRCodeStatusCanceled
	if err := database.DB.Save(&qrCode).Error; err != nil {
		return err
	}

	s.notifyStatusChange(qrCodeID, model.QRCodeStatusCanceled, "")

	return nil
}

func (s *QRCodeService) RegisterWebSocket(qrCodeID string, conn *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.connections[qrCodeID] = &qrConn{
		conn:      conn,
		expiresAt: time.Now().Add(qrCodeExpireTime * time.Second),
	}
}

func (s *QRCodeService) UnregisterWebSocket(qrCodeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.connections, qrCodeID)
}

func (s *QRCodeService) notifyStatusChange(qrCodeID string, status int, token string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	qc, exists := s.connections[qrCodeID]
	if !exists {
		return
	}

	message := QRCodeStatusMessage{
		QRCodeID: qrCodeID,
		Status:   status,
		Token:    token,
	}

	data, _ := json.Marshal(message)
	qc.conn.WriteMessage(websocket.TextMessage, data)

	if status == model.QRCodeStatusConfirmed || status == model.QRCodeStatusCanceled || status == model.QRCodeStatusExpired {
		qc.conn.Close()
		delete(s.connections, qrCodeID)
	}
}

func (s *QRCodeService) cleanupExpiredConnections() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.cleanExpired()
		case <-s.stopCh:
			return
		}
	}
}

func (s *QRCodeService) cleanExpired() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for qrCodeID, qc := range s.connections {
		if now.After(qc.expiresAt) {
			expiredMsg := QRCodeStatusMessage{
				QRCodeID: qrCodeID,
				Status:   model.QRCodeStatusExpired,
			}
			data, _ := json.Marshal(expiredMsg)
			qc.conn.WriteMessage(websocket.TextMessage, data)
			qc.conn.Close()
			delete(s.connections, qrCodeID)
		}
	}
}

func (s *QRCodeService) Stop() {
	close(s.stopCh)
}
