package service

import (
	"errors"
	"strings"

	"auth-service/internal/database"
	"auth-service/internal/model"
	"auth-service/internal/util"

	"gorm.io/gorm"
)

type UserService struct{}

func NewUserService() *UserService {
	return &UserService{}
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Code     string `json:"code"`
	Nickname string `json:"nickname"`
}

func (s *UserService) Register(req *RegisterRequest) (*model.User, error) {
	if !util.IsValidUsername(req.Username) {
		return nil, errors.New("invalid username format")
	}

	if !util.IsValidPassword(req.Password) {
		return nil, errors.New("password must be 8-32 characters and contain uppercase, lowercase and digit")
	}

	if req.Phone == "" && req.Email == "" {
		return nil, errors.New("phone or email is required")
	}

	if req.Phone != "" {
		if !util.IsValidPhone(req.Phone) {
			return nil, errors.New("invalid phone number")
		}
	}

	if req.Email != "" {
		if !util.IsValidEmail(req.Email) {
			return nil, errors.New("invalid email format")
		}
	}

	var existingUser model.User
	err := database.DB.Where("username = ? OR phone = ? OR email = ?",
		req.Username, req.Phone, req.Email).First(&existingUser).Error

	if err == nil {
		return nil, errors.New("registration failed, please check your information")
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("database error")
	}

	if req.Phone != "" {
		codeService := NewCodeService()
		valid, err := codeService.VerifyCode(nil, req.Phone, req.Code, model.UsageRegister)
		if err != nil || !valid {
			return nil, errors.New("invalid verification code")
		}
	}

	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	user := &model.User{
		Username:     strings.ToLower(req.Username),
		PasswordHash: hashedPassword,
		Phone:        req.Phone,
		Email:        req.Email,
		Nickname:     req.Nickname,
		Status:       model.UserStatusNormal,
	}

	if err := database.DB.Create(user).Error; err != nil {
		return nil, errors.New("failed to create user")
	}

	var defaultRole model.Role
	if err := database.DB.Where("code = ?", "user").First(&defaultRole).Error; err == nil {
		database.DB.Model(user).Association("Roles").Append(&defaultRole)
	}

	return user, nil
}

func (s *UserService) GetUserByAccount(account string) (*model.User, error) {
	var user model.User
	accountType := util.GetAccountType(account)

	var err error
	switch accountType {
	case "phone":
		err = database.DB.Where("phone = ?", account).Preload("Roles.Permissions").First(&user).Error
	case "email":
		err = database.DB.Where("email = ?", account).Preload("Roles.Permissions").First(&user).Error
	default:
		err = database.DB.Where("username = ?", strings.ToLower(account)).Preload("Roles.Permissions").First(&user).Error
	}

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) GetUserByID(userID uint) (*model.User, error) {
	var user model.User
	err := database.DB.Preload("Roles.Permissions").First(&user, userID).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) CheckUsernameExists(username string) bool {
	var count int64
	database.DB.Model(&model.User{}).Where("username = ?", strings.ToLower(username)).Count(&count)
	return count > 0
}

func (s *UserService) CheckPhoneExists(phone string) bool {
	var count int64
	database.DB.Model(&model.User{}).Where("phone = ?", phone).Count(&count)
	return count > 0
}

func (s *UserService) CheckEmailExists(email string) bool {
	var count int64
	database.DB.Model(&model.User{}).Where("email = ?", email).Count(&count)
	return count > 0
}
