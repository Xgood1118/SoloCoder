package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/purchase-workflow/internal/config"
	"github.com/purchase-workflow/internal/model"
	"github.com/purchase-workflow/internal/repository"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db *gorm.DB
}

func NewAuthService() *AuthService {
	return &AuthService{
		db: repository.GetDB(),
	}
}

func (s *AuthService) Login(username, password string) (*model.LoginResponse, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, errors.New("用户名或密码错误")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("用户名或密码错误")
	}

	token, err := s.generateToken(&user)
	if err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		Token: token,
		User:  &user,
	}, nil
}

func (s *AuthService) generateToken(user *model.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":   user.ID,
		"username":  user.Username,
		"role":      user.Role,
		"real_name": user.RealName,
		"exp":       time.Now().Add(time.Hour * time.Duration(config.AppConfig.JWT.ExpiresHours)).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWT.Secret))
}

func (s *AuthService) ParseToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWT.Secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效的token")
}

func (s *AuthService) CreateUser(user *model.User, password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.PasswordHash = string(hashedPassword)
	return s.db.Create(user).Error
}

func (s *AuthService) GetUserByID(id uint64) (*model.User, error) {
	var user model.User
	if err := s.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) InitDefaultUsers() error {
	var count int64
	s.db.Model(&model.User{}).Count(&count)
	if count > 0 {
		return nil
	}

	users := []struct {
		user     model.User
		password string
	}{
		{
			user: model.User{
				Username:     "admin",
				RealName:     "管理员",
				Role:         "admin",
				DepartmentID: 1,
				Email:        "admin@example.com",
			},
			password: "admin123",
		},
		{
			user: model.User{
				Username:     "employee1",
				RealName:     "张三",
				Role:         "employee",
				DepartmentID: 2,
				Email:        "zhangsan@example.com",
			},
			password: "123456",
		},
		{
			user: model.User{
				Username:     "supervisor1",
				RealName:     "王主管",
				Role:         "supervisor",
				DepartmentID: 2,
				Email:        "wang@example.com",
			},
			password: "123456",
		},
		{
			user: model.User{
				Username:     "dept_manager",
				RealName:     "李经理",
				Role:         "dept_manager",
				DepartmentID: 2,
				Email:        "li@example.com",
			},
			password: "123456",
		},
		{
			user: model.User{
				Username:     "finance1",
				RealName:     "财务专员",
				Role:         "finance",
				DepartmentID: 3,
				Email:        "finance@example.com",
			},
			password: "123456",
		},
		{
			user: model.User{
				Username:     "finance_manager",
				RealName:     "财务经理",
				Role:         "finance_manager",
				DepartmentID: 3,
				Email:        "fin_manager@example.com",
			},
			password: "123456",
		},
		{
			user: model.User{
				Username:     "risk_manager",
				RealName:     "风控经理",
				Role:         "risk_manager",
				DepartmentID: 4,
				Email:        "risk@example.com",
			},
			password: "123456",
		},
	}

	for _, u := range users {
		if err := s.CreateUser(&u.user, u.password); err != nil {
			return err
		}
	}

	return nil
}
