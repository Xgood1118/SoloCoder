package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/scheduler/go-auto-scheduler/internal/audit"
	"github.com/scheduler/go-auto-scheduler/internal/models"
	"github.com/scheduler/go-auto-scheduler/internal/storage"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidToken = errors.New("invalid token")
)

type AuthMiddleware struct {
	db        *storage.Database
	auditor   *audit.Auditor
	jwtSecret string
}

func NewAuthMiddleware(db *storage.Database, auditor *audit.Auditor, jwtSecret string) *AuthMiddleware {
	return &AuthMiddleware{
		db:        db,
		auditor:   auditor,
		jwtSecret: jwtSecret,
	}
}

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	User        *UserInfo `json:"user"`
}

type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

func (m *AuthMiddleware) HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password + m.jwtSecret))
	return hex.EncodeToString(hash[:])
}

func (m *AuthMiddleware) VerifyPassword(password, hash string) bool {
	return m.HashPassword(password) == hash
}

func (m *AuthMiddleware) GenerateToken(user *models.User) (string, int, error) {
	expiresIn := 3600 * 24
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiresIn) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "scheduler",
			Subject:   user.ID,
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(m.jwtSecret))
	if err != nil {
		return "", 0, err
	}

	return tokenString, expiresIn, nil
}

func (m *AuthMiddleware) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(m.jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, ErrInvalidToken
}

func (m *AuthMiddleware) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	user, err := m.db.GetUserByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if !m.VerifyPassword(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	token, expiresIn, err := m.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	ip := c.ClientIP()
	ctx := audit.WithAuditContext(c.Request.Context(), user.ID, user.Username, ip, true)
	m.auditor.LogLogin(ctx, user.ID, user.Username, ip)

	c.JSON(http.StatusOK, LoginResponse{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresIn:   expiresIn,
		User: &UserInfo{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
		},
	})
}

func (m *AuthMiddleware) Logout(c *gin.Context) {
	userID := c.GetString("user_id")
	username := c.GetString("username")
	ip := c.ClientIP()

	ctx := audit.WithAuditContext(c.Request.Context(), userID, username, ip, true)
	m.auditor.LogLogout(ctx, userID, username, ip)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (m *AuthMiddleware) AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			return
		}

		tokenString := parts[1]
		claims, err := m.ParseToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		user, err := m.db.GetUser(claims.UserID)
		if err != nil || !user.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not found or inactive"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)

		ip := c.ClientIP()
		confirmed := c.GetHeader("X-Operation-Confirmed") == "true"
		ctx := audit.WithAuditContext(c.Request.Context(), claims.UserID, claims.Username, ip, confirmed)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

func (m *AuthMiddleware) AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Admin privileges required"})
			return
		}
		c.Next()
	}
}

func (m *AuthMiddleware) CanAccessTask(taskID string, userID string, role string) bool {
	if role == "admin" {
		return true
	}

	task, err := m.db.GetTask(taskID)
	if err != nil {
		return false
	}

	return task.UserID == userID
}

func (m *AuthMiddleware) TaskAccessRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		userID := c.GetString("user_id")
		role := c.GetString("role")

		if !m.CanAccessTask(taskID, userID, role) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this task"})
			return
		}

		c.Next()
	}
}

func (m *AuthMiddleware) CanAccessExecutor(executorID string, userID string, role string) bool {
	if role == "admin" {
		return true
	}

	executor, err := m.db.GetExecutor(executorID)
	if err != nil {
		return false
	}

	return executor.UserID == userID
}

func (m *AuthMiddleware) ExecutorAccessRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		executorID := c.Param("id")
		userID := c.GetString("user_id")
		role := c.GetString("role")

		if !m.CanAccessExecutor(executorID, userID, role) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this executor"})
			return
		}

		c.Next()
	}
}

func (m *AuthMiddleware) CanViewTaskLogs(taskID string, userID string, role string) bool {
	return m.CanAccessTask(taskID, userID, role)
}

func (m *AuthMiddleware) TaskLogAccessRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Query("task_id")
		if taskID == "" {
			taskID = c.Param("task_id")
		}

		if taskID == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "task_id is required"})
			return
		}

		userID := c.GetString("user_id")
		role := c.GetString("role")

		if !m.CanViewTaskLogs(taskID, userID, role) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access these logs"})
			return
		}

		c.Next()
	}
}

func (m *AuthMiddleware) CreateDefaultUser() error {
	_, err := m.db.GetUserByUsername("admin")
	if err == nil {
		return nil
	}

	admin := &models.User{
		Username: "admin",
		Password: m.HashPassword("admin123"),
		Email:    "admin@scheduler.local",
		Role:     "admin",
		IsActive: true,
	}

	if err := m.db.CreateUser(admin); err != nil {
		return err
	}

	user := &models.User{
		Username: "user",
		Password: m.HashPassword("user123"),
		Email:    "user@scheduler.local",
		Role:     "user",
		IsActive: true,
	}

	return m.db.CreateUser(user)
}

func (m *AuthMiddleware) CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Operation-Confirmed")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
