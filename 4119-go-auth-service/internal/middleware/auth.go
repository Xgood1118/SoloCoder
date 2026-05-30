package middleware

import (
	"strings"

	"auth-service/internal/service"
	"auth-service/internal/util"

	"github.com/gin-gonic/gin"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			util.Unauthorized(c, "authorization header is required")
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			util.Unauthorized(c, "invalid authorization format")
			c.Abort()
			return
		}

		claims, err := util.ParseAccessToken(parts[1])
		if err != nil {
			util.Unauthorized(c, "invalid or expired token")
			c.Abort()
			return
		}

		authService := service.NewAuthService()
		if !authService.ValidateSession(claims.SessionID) {
			util.Unauthorized(c, "session has been revoked")
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("session_id", claims.SessionID)
		c.Set("permissions", claims.Permissions)

		c.Next()
	}
}

func PermissionRequired(permissionCode string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissions, exists := c.Get("permissions")
		if !exists {
			util.Forbidden(c, "permission denied")
			c.Abort()
			return
		}

		permList, ok := permissions.([]string)
		if !ok {
			util.Forbidden(c, "permission denied")
			c.Abort()
			return
		}

		hasPermission := false
		for _, p := range permList {
			if p == permissionCode || p == "*" {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			util.Forbidden(c, "permission denied")
			c.Abort()
			return
		}

		c.Next()
	}
}

func RoleRequired(roleCode string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			util.Forbidden(c, "role required")
			c.Abort()
			return
		}

		rbacService := service.NewRBACService()
		roles, err := rbacService.GetUserRoles(userID.(uint))
		if err != nil {
			util.Forbidden(c, "role required")
			c.Abort()
			return
		}

		hasRole := false
		for _, role := range roles {
			if role.Code == roleCode || role.Code == "admin" {
				hasRole = true
				break
			}
		}

		if !hasRole {
			util.Forbidden(c, "role required")
			c.Abort()
			return
		}

		c.Next()
	}
}

func GetCurrentUserID(c *gin.Context) uint {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0
	}
	return userID.(uint)
}

func GetCurrentSessionID(c *gin.Context) string {
	sessionID, exists := c.Get("session_id")
	if !exists {
		return ""
	}
	return sessionID.(string)
}
