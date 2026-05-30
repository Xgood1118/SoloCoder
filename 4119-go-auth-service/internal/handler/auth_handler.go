package handler

import (
	"net/http"
	"time"

	"auth-service/internal/config"
	"auth-service/internal/service"
	"auth-service/internal/util"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type AuthHandler struct {
	authService     *service.AuthService
	userService     *service.UserService
	codeService     *service.CodeService
	qrCodeService   *service.QRCodeService
	passwordService *service.PasswordService
	sessionService  *service.SessionService
	upgrader        websocket.Upgrader
}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{
		authService:     service.NewAuthService(),
		userService:     service.NewUserService(),
		codeService:     service.NewCodeService(),
		qrCodeService:   service.NewQRCodeService(),
		passwordService: service.NewPasswordService(),
		sessionService:  service.NewSessionService(),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

type LoginRequest struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	resp, sessionID, err := h.authService.Login(&service.LoginRequest{
		Account:  req.Account,
		Password: req.Password,
	}, ip, userAgent)

	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	c.SetCookie("refresh_token", resp.RefreshToken,
		config.AppConfig.JWT.RefreshTokenExpire,
		"/",
		config.AppConfig.SSO.Domain,
		true,
		true,
	)

	c.SetCookie("session_id", sessionID,
		config.AppConfig.JWT.RefreshTokenExpire,
		"/",
		config.AppConfig.SSO.Domain,
		true,
		true,
	)

	util.Success(c, resp)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	user, err := h.userService.Register(&req)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, gin.H{
		"id":       user.ID,
		"username": user.Username,
	})
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		util.Unauthorized(c, "refresh token not found")
		return
	}

	resp, sessionID, err := h.authService.RefreshToken(refreshToken)
	if err != nil {
		util.Unauthorized(c, err.Error())
		return
	}

	c.SetCookie("refresh_token", resp.RefreshToken,
		config.AppConfig.JWT.RefreshTokenExpire,
		"/",
		config.AppConfig.SSO.Domain,
		true,
		true,
	)

	c.SetCookie("session_id", sessionID,
		config.AppConfig.JWT.RefreshTokenExpire,
		"/",
		config.AppConfig.SSO.Domain,
		true,
		true,
	)

	util.Success(c, resp)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	sessionID, _ := c.Cookie("session_id")
	if sessionID == "" {
		sessionID = c.GetString("session_id")
	}

	if sessionID != "" {
		h.authService.Logout(sessionID)
	}

	c.SetCookie("refresh_token", "", -1, "/", config.AppConfig.SSO.Domain, true, true)
	c.SetCookie("session_id", "", -1, "/", config.AppConfig.SSO.Domain, true, true)

	util.Success(c, nil)
}

func (h *AuthHandler) SendCode(c *gin.Context) {
	var req struct {
		Target string `json:"target" binding:"required"`
		Usage  string `json:"usage" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	var err error
	if util.IsValidPhone(req.Target) {
		err = h.codeService.SendSMSCode(c, req.Target, req.Usage)
	} else if util.IsValidEmail(req.Target) {
		err = h.codeService.SendEmailCode(c, req.Target, req.Usage)
	} else {
		util.ParamError(c, "invalid target")
		return
	}

	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) CreateQRCode(c *gin.Context) {
	qrCodeID, err := h.qrCodeService.CreateQRCode()
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, gin.H{
		"qr_code_id": qrCodeID,
		"expires_at":  time.Now().Add(5 * time.Minute).Unix(),
	})
}

func (h *AuthHandler) GetQRCodeStatus(c *gin.Context) {
	qrCodeID := c.Param("id")
	status, err := h.qrCodeService.GetQRCodeStatus(qrCodeID)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, gin.H{
		"status": status,
	})
}

func (h *AuthHandler) QRCodeWebSocket(c *gin.Context) {
	qrCodeID := c.Query("qr_code_id")
	if qrCodeID == "" {
		util.ParamError(c, "qr_code_id is required")
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	h.qrCodeService.RegisterWebSocket(qrCodeID, conn)

	defer func() {
		h.qrCodeService.UnregisterWebSocket(qrCodeID)
		conn.Close()
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (h *AuthHandler) ScanQRCode(c *gin.Context) {
	var req struct {
		QRCodeID string `json:"qr_code_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	err := h.qrCodeService.ScanQRCode(req.QRCodeID, userID)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) ConfirmQRCode(c *gin.Context) {
	var req struct {
		QRCodeID string `json:"qr_code_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	token, err := h.qrCodeService.ConfirmQRCode(req.QRCodeID, userID, ip, userAgent)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, gin.H{
		"token": token,
	})
}

func (h *AuthHandler) CancelQRCode(c *gin.Context) {
	var req struct {
		QRCodeID string `json:"qr_code_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	err := h.qrCodeService.CancelQRCode(req.QRCodeID, userID)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) RequestPasswordReset(c *gin.Context) {
	var req struct {
		Target string `json:"target" binding:"required"`
		Type   string `json:"type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	var err error
	if req.Type == "email" {
		_, err = h.passwordService.RequestResetByEmail(req.Target)
	} else if req.Type == "sms" {
		err = h.passwordService.RequestResetByPhone(req.Target)
	} else {
		util.ParamError(c, "invalid type")
		return
	}

	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token"`
		Phone       string `json:"phone"`
		Code        string `json:"code"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	var err error
	if req.Token != "" {
		err = h.passwordService.ResetByToken(req.Token, req.NewPassword)
	} else if req.Phone != "" && req.Code != "" {
		err = h.passwordService.ResetByCode(req.Phone, req.Code, req.NewPassword)
	} else {
		util.ParamError(c, "token or phone+code is required")
		return
	}

	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	userID := c.GetUint("user_id")
	sessionID, _ := c.Get("session_id")
	currentSessionID := ""
	if sid, ok := sessionID.(string); ok {
		currentSessionID = sid
	}
	err := h.passwordService.ChangePassword(userID, currentSessionID, req.OldPassword, req.NewPassword)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID := c.GetUint("user_id")
	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		util.Error(c, util.CodeError, "user not found")
		return
	}

	util.Success(c, user)
}

func (h *AuthHandler) GetSessions(c *gin.Context) {
	userID := c.GetUint("user_id")
	sessions, err := h.sessionService.GetUserSessions(userID)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, sessions)
}

func (h *AuthHandler) RevokeSession(c *gin.Context) {
	sessionID := c.Param("id")
	userID := c.GetUint("user_id")

	err := h.sessionService.RevokeSession(userID, sessionID)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) GetLoginHistory(c *gin.Context) {
	userID := c.GetUint("user_id")
	page := 1
	pageSize := 20

	history, total, err := h.sessionService.GetLoginHistory(userID, page, pageSize)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, gin.H{
		"list":  history,
		"total": total,
	})
}

func (h *AuthHandler) KickUser(c *gin.Context) {
	var req struct {
		UserID uint   `json:"user_id" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.ParamError(c, "invalid request")
		return
	}

	err := h.sessionService.KickUser(req.UserID, req.Reason)
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, nil)
}

func (h *AuthHandler) GetOnlineUsers(c *gin.Context) {
	userIDs, err := h.sessionService.GetOnlineUsers()
	if err != nil {
		util.Error(c, util.CodeError, err.Error())
		return
	}

	util.Success(c, gin.H{
		"user_ids": userIDs,
		"count":    len(userIDs),
	})
}
