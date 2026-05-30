package service

import (
	"errors"
	"fmt"
	"time"

	"auth-service/internal/database"
	"auth-service/internal/model"
	"auth-service/internal/util"
)

type PasswordService struct{}

func NewPasswordService() *PasswordService {
	return &PasswordService{}
}

const (
	passwordResetTokenExpire = 24 * time.Hour
)

func (s *PasswordService) RequestResetByEmail(email string) (string, error) {
	if !util.IsValidEmail(email) {
		return "", errors.New("invalid email")
	}

	var user model.User
	if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return "", errors.New("email not found")
	}

	token, err := util.GeneratePasswordResetToken()
	if err != nil {
		return "", err
	}

	resetToken := &model.PasswordResetToken{
		UserID:    user.ID,
		Token:     token,
		Type:      "email",
		ExpiresAt: time.Now().Add(passwordResetTokenExpire),
		IsUsed:    false,
	}

	if err := database.DB.Create(resetToken).Error; err != nil {
		return "", err
	}

	fmt.Printf("Password reset email sent to %s: token=%s\n", email, token)

	return token, nil
}

func (s *PasswordService) RequestResetByPhone(phone string) error {
	if !util.IsValidPhone(phone) {
		return errors.New("invalid phone number")
	}

	var user model.User
	if err := database.DB.Where("phone = ?", phone).First(&user).Error; err != nil {
		return errors.New("phone not found")
	}

	codeService := NewCodeService()
	return codeService.SendSMSCode(nil, phone, model.UsageResetPassword)
}

func (s *PasswordService) ResetByToken(token, newPassword string) error {
	var resetToken model.PasswordResetToken
	if err := database.DB.Where("token = ?", token).First(&resetToken).Error; err != nil {
		return errors.New("invalid or expired token")
	}

	if !resetToken.IsValid() {
		return errors.New("invalid or expired token")
	}

	if !util.IsValidPassword(newPassword) {
		return errors.New("invalid password format")
	}

	hashedPassword, err := util.HashPassword(newPassword)
	if err != nil {
		return err
	}

	tx := database.DB.Begin()

	if err := tx.Model(&model.User{}).Where("id = ?", resetToken.UserID).Update("password_hash", hashedPassword).Error; err != nil {
		tx.Rollback()
		return err
	}

	resetToken.IsUsed = true
	if err := tx.Save(&resetToken).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&model.Session{}).Where("user_id = ? AND is_revoked = ?", resetToken.UserID, false).Update("is_revoked", true).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()

	return nil
}

func (s *PasswordService) ResetByCode(phone, code, newPassword string) error {
	codeService := NewCodeService()
	valid, err := codeService.VerifyCode(nil, phone, code, model.UsageResetPassword)
	if err != nil || !valid {
		return errors.New("invalid verification code")
	}

	var user model.User
	if err := database.DB.Where("phone = ?", phone).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	if !util.IsValidPassword(newPassword) {
		return errors.New("invalid password format")
	}

	hashedPassword, err := util.HashPassword(newPassword)
	if err != nil {
		return err
	}

	tx := database.DB.Begin()

	if err := tx.Model(&model.User{}).Where("id = ?", user.ID).Update("password_hash", hashedPassword).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&model.Session{}).Where("user_id = ? AND is_revoked = ?", user.ID, false).Update("is_revoked", true).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()

	return nil
}

func (s *PasswordService) ChangePassword(userID uint, currentSessionID, oldPassword, newPassword string) error {
	var user model.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return errors.New("user not found")
	}

	if !util.CheckPasswordHash(oldPassword, user.PasswordHash) {
		return errors.New("invalid old password")
	}

	if !util.IsValidPassword(newPassword) {
		return errors.New("invalid password format")
	}

	hashedPassword, err := util.HashPassword(newPassword)
	if err != nil {
		return err
	}

	tx := database.DB.Begin()

	if err := tx.Model(&model.User{}).Where("id = ?", userID).Update("password_hash", hashedPassword).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&model.Session{}).Where("user_id = ? AND is_revoked = ? AND session_id != ?", userID, false, currentSessionID).Update("is_revoked", true).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()
	return nil
}
