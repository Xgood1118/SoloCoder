package service

import (
	"encoding/json"
	"fmt"
	"time"

	"auth-service/internal/cache"
	"auth-service/internal/database"
	"auth-service/internal/model"
)

type RBACService struct{}

func NewRBACService() *RBACService {
	return &RBACService{}
}

const (
	rolePermissionsCacheKey = "rbac:role:%d:permissions"
	userRolesCacheKey       = "rbac:user:%d:roles"
	cacheTTL                = 30 * time.Minute
	permissionChangeChannel = "rbac:permission_change"
)

func (s *RBACService) GetRolePermissions(roleID uint) ([]model.Permission, error) {
	cacheKey := fmt.Sprintf(rolePermissionsCacheKey, roleID)
	if cached, err := cache.Get(nil, cacheKey); err == nil {
		var permissions []model.Permission
		if json.Unmarshal([]byte(cached), &permissions) == nil {
			return permissions, nil
		}
	}

	var role model.Role
	if err := database.DB.Preload("Permissions").First(&role, roleID).Error; err != nil {
		return nil, err
	}

	data, _ := json.Marshal(role.Permissions)
	cache.Set(nil, cacheKey, string(data), cacheTTL)

	return role.Permissions, nil
}

func (s *RBACService) GetUserRoles(userID uint) ([]model.Role, error) {
	cacheKey := fmt.Sprintf(userRolesCacheKey, userID)
	if cached, err := cache.Get(nil, cacheKey); err == nil {
		var roles []model.Role
		if json.Unmarshal([]byte(cached), &roles) == nil {
			return roles, nil
		}
	}

	var user model.User
	if err := database.DB.Preload("Roles").First(&user, userID).Error; err != nil {
		return nil, err
	}

	data, _ := json.Marshal(user.Roles)
	cache.Set(nil, cacheKey, string(data), cacheTTL)

	return user.Roles, nil
}

func (s *RBACService) GetUserPermissions(userID uint) ([]string, error) {
	user, err := NewUserService().GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	return user.GetPermissionCodes(), nil
}

func (s *RBACService) HasPermission(userID uint, permissionCode string) (bool, error) {
	permissions, err := s.GetUserPermissions(userID)
	if err != nil {
		return false, err
	}

	for _, p := range permissions {
		if p == permissionCode {
			return true, nil
		}
	}
	return false, nil
}

func (s *RBACService) AssignRoleToUser(userID, roleID uint) error {
	var user model.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return err
	}

	var role model.Role
	if err := database.DB.First(&role, roleID).Error; err != nil {
		return err
	}

	if err := database.DB.Model(&user).Association("Roles").Append(&role); err != nil {
		return err
	}

	s.invalidateUserCache(userID)
	s.notifyPermissionChange(userID)

	return nil
}

func (s *RBACService) RemoveRoleFromUser(userID, roleID uint) error {
	var user model.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return err
	}

	var role model.Role
	if err := database.DB.First(&role, roleID).Error; err != nil {
		return err
	}

	if err := database.DB.Model(&user).Association("Roles").Delete(&role); err != nil {
		return err
	}

	s.invalidateUserCache(userID)
	s.notifyPermissionChange(userID)

	return nil
}

func (s *RBACService) AssignPermissionToRole(roleID, permissionID uint) error {
	var role model.Role
	if err := database.DB.First(&role, roleID).Error; err != nil {
		return err
	}

	var permission model.Permission
	if err := database.DB.First(&permission, permissionID).Error; err != nil {
		return err
	}

	if err := database.DB.Model(&role).Association("Permissions").Append(&permission); err != nil {
		return err
	}

	s.invalidateRoleCache(roleID)
	s.notifyRolePermissionChange(roleID)

	return nil
}

func (s *RBACService) RemovePermissionFromRole(roleID, permissionID uint) error {
	var role model.Role
	if err := database.DB.First(&role, roleID).Error; err != nil {
		return err
	}

	var permission model.Permission
	if err := database.DB.First(&permission, permissionID).Error; err != nil {
		return err
	}

	if err := database.DB.Model(&role).Association("Permissions").Delete(&permission); err != nil {
		return err
	}

	s.invalidateRoleCache(roleID)
	s.notifyRolePermissionChange(roleID)

	return nil
}

func (s *RBACService) invalidateUserCache(userID uint) {
	cacheKey := fmt.Sprintf(userRolesCacheKey, userID)
	cache.Del(nil, cacheKey)
}

func (s *RBACService) invalidateRoleCache(roleID uint) {
	cacheKey := fmt.Sprintf(rolePermissionsCacheKey, roleID)
	cache.Del(nil, cacheKey)
}

func (s *RBACService) notifyPermissionChange(userID uint) {
	message := fmt.Sprintf("user:%d", userID)
	cache.Publish(nil, permissionChangeChannel, message)
}

func (s *RBACService) notifyRolePermissionChange(roleID uint) {
	message := fmt.Sprintf("role:%d", roleID)
	cache.Publish(nil, permissionChangeChannel, message)
}

func (s *RBACService) StartPermissionChangeListener() {
	pubsub := cache.Subscribe(nil, permissionChangeChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		s.handlePermissionChange(msg.Payload)
	}
}

func (s *RBACService) handlePermissionChange(message string) {
	if len(message) > 5 && message[:5] == "user:" {
		var userID uint
		fmt.Sscanf(message[5:], "%d", &userID)
		s.invalidateUserCache(userID)
	} else if len(message) > 5 && message[:5] == "role:" {
		var roleID uint
		fmt.Sscanf(message[5:], "%d", &roleID)
		s.invalidateRoleCache(roleID)
	}
}

func (s *RBACService) StartCacheSyncJob() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.syncCacheWithDB()
	}
}

func (s *RBACService) syncCacheWithDB() {
	var roles []model.Role
	database.DB.Find(&roles)

	for _, role := range roles {
		cacheKey := fmt.Sprintf(rolePermissionsCacheKey, role.ID)
		cached, err := cache.Get(nil, cacheKey)
		if err != nil {
			continue
		}

		var cachedPerms []model.Permission
		if json.Unmarshal([]byte(cached), &cachedPerms) != nil {
			continue
		}

		var dbRole model.Role
		database.DB.Preload("Permissions").First(&dbRole, role.ID)

		if len(cachedPerms) != len(dbRole.Permissions) {
			s.invalidateRoleCache(role.ID)
		}
	}
}

func (s *RBACService) CreateRole(name, code, description string) (*model.Role, error) {
	role := &model.Role{
		Name:        name,
		Code:        code,
		Description: description,
	}
	if err := database.DB.Create(role).Error; err != nil {
		return nil, err
	}
	return role, nil
}

func (s *RBACService) CreatePermission(name, code, permType, resource, action, description string) (*model.Permission, error) {
	permission := &model.Permission{
		Name:        name,
		Code:        code,
		Type:        permType,
		Resource:    resource,
		Action:      action,
		Description: description,
	}
	if err := database.DB.Create(permission).Error; err != nil {
		return nil, err
	}
	return permission, nil
}
