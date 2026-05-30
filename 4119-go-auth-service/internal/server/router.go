package server

import (
	"auth-service/internal/handler"
	"auth-service/internal/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	authHandler := handler.NewAuthHandler()

	api := r.Group("/api/v1")

	auth := api.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/register", authHandler.Register)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", middleware.JWTAuth(), authHandler.Logout)
	}

	code := api.Group("/code")
	{
		code.POST("/send", authHandler.SendCode)
	}

	qrcode := api.Group("/qrcode")
	{
		qrcode.POST("/create", authHandler.CreateQRCode)
		qrcode.GET("/status/:id", authHandler.GetQRCodeStatus)
		qrcode.GET("/ws", authHandler.QRCodeWebSocket)
		qrcode.POST("/scan", middleware.JWTAuth(), authHandler.ScanQRCode)
		qrcode.POST("/confirm", middleware.JWTAuth(), authHandler.ConfirmQRCode)
		qrcode.POST("/cancel", middleware.JWTAuth(), authHandler.CancelQRCode)
	}

	password := api.Group("/password")
	{
		password.POST("/request-reset", authHandler.RequestPasswordReset)
		password.POST("/reset", authHandler.ResetPassword)
		password.POST("/change", middleware.JWTAuth(), authHandler.ChangePassword)
	}

	user := api.Group("/user")
	user.Use(middleware.JWTAuth())
	{
		user.GET("/me", authHandler.GetCurrentUser)
		user.GET("/sessions", authHandler.GetSessions)
		user.DELETE("/sessions/:id", authHandler.RevokeSession)
		user.GET("/login-history", authHandler.GetLoginHistory)
	}

	admin := api.Group("/admin")
	admin.Use(middleware.JWTAuth(), middleware.RoleRequired("admin"))
	{
		admin.POST("/kick-user", authHandler.KickUser)
		admin.GET("/online-users", authHandler.GetOnlineUsers)
	}
}
