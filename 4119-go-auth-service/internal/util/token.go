package util

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"auth-service/internal/config"
	"auth-service/internal/model"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type TokenClaims struct {
	UserID      uint     `json:"user_id"`
	Username    string   `json:"username"`
	SessionID   string   `json:"session_id"`
	Permissions []string `json:"permissions,omitempty"`
	jwt.RegisteredClaims
}

var jwtSecret []byte

func InitJWTSecret() error {
	secret := make([]byte, 32)
	_, err := rand.Read(secret)
	if err != nil {
		return err
	}
	jwtSecret = secret
	return nil
}

func GenerateRandomToken(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func GenerateSessionID() string {
	return uuid.NewString()
}

func GenerateCode(length int) string {
	if length <= 0 {
		length = 4
	}
	code := make([]byte, length)
	for i := range code {
		b := make([]byte, 1)
		rand.Read(b)
		code[i] = '0' + (b[0] % 10)
	}
	return string(code)
}

func GenerateAccessToken(user *model.User, sessionID string, permissions []string) (string, error) {
	now := time.Now()
	expireTime := now.Add(time.Duration(config.AppConfig.JWT.AccessTokenExpire) * time.Second)

	claims := TokenClaims{
		UserID:      user.ID,
		Username:    user.Username,
		SessionID:   sessionID,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expireTime),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    config.AppConfig.JWT.Issuer,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func GenerateRefreshToken() (string, error) {
	return GenerateRandomToken(32)
}

func ParseAccessToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*TokenClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func GeneratePasswordResetToken() (string, error) {
	tokenBytes := make([]byte, 32)
	_, err := rand.Read(tokenBytes)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(tokenBytes), nil
}
