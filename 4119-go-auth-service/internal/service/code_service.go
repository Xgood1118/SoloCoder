package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"auth-service/internal/cache"
	"auth-service/internal/database"
	"auth-service/internal/model"
	"auth-service/internal/util"
)

type CodeService struct{}

func NewCodeService() *CodeService {
	return &CodeService{}
}

const (
	minuteLimitKey = "sms:minute:%s"
	hourLimitKey   = "sms:hour:%s"
	codeCacheKey   = "sms:code:%s:%s"
	codeExpireTime = 5 * 60
)

func (s *CodeService) SendSMSCode(ctx context.Context, phone, usage string) error {
	if !util.IsValidPhone(phone) {
		return errors.New("invalid phone number")
	}

	minuteKey := fmt.Sprintf(minuteLimitKey, phone)
	hourKey := fmt.Sprintf(hourLimitKey, phone)

	minuteCount, err := cache.Client.Incr(ctx, minuteKey).Result()
	if err != nil {
		return err
	}
	if minuteCount == 1 {
		cache.Client.Expire(ctx, minuteKey, 60*time.Second)
	}
	if minuteCount > 1 {
		return errors.New("please wait 60 seconds before requesting again")
	}

	hourCount, err := cache.Client.Incr(ctx, hourKey).Result()
	if err != nil {
		return err
	}
	if hourCount == 1 {
		cache.Client.Expire(ctx, hourKey, 3600*time.Second)
	}
	if hourCount > 10 {
		return errors.New("too many requests, please try again later")
	}

	code := util.GenerateCode(4)

	codeKey := fmt.Sprintf(codeCacheKey, usage, phone)
	cache.Client.HSet(ctx, codeKey, "code", code)
	cache.Client.HSet(ctx, codeKey, "attempts", 0)
	cache.Client.Expire(ctx, codeKey, time.Duration(codeExpireTime)*time.Second)

	_ = s.saveVerificationCode(phone, code, model.CodeTypeSMS, usage)

	fmt.Printf("SMS sent to %s: code=%s\n", phone, code)

	return nil
}

func (s *CodeService) SendEmailCode(ctx context.Context, email, usage string) error {
	if !util.IsValidEmail(email) {
		return errors.New("invalid email address")
	}

	minuteKey := fmt.Sprintf(minuteLimitKey, email)
	hourKey := fmt.Sprintf(hourLimitKey, email)

	minuteCount, err := cache.Client.Incr(ctx, minuteKey).Result()
	if err != nil {
		return err
	}
	if minuteCount == 1 {
		cache.Client.Expire(ctx, minuteKey, 60*time.Second)
	}
	if minuteCount > 1 {
		return errors.New("please wait 60 seconds before requesting again")
	}

	hourCount, err := cache.Client.Incr(ctx, hourKey).Result()
	if err != nil {
		return err
	}
	if hourCount == 1 {
		cache.Client.Expire(ctx, hourKey, 3600*time.Second)
	}
	if hourCount > 10 {
		return errors.New("too many requests, please try again later")
	}

	code := util.GenerateCode(4)

	codeKey := fmt.Sprintf(codeCacheKey, usage, email)
	cache.Client.HSet(ctx, codeKey, "code", code)
	cache.Client.HSet(ctx, codeKey, "attempts", 0)
	cache.Client.Expire(ctx, codeKey, time.Duration(codeExpireTime)*time.Second)

	_ = s.saveVerificationCode(email, code, model.CodeTypeEmail, usage)

	fmt.Printf("Email sent to %s: code=%s\n", email, code)

	return nil
}

func (s *CodeService) VerifyCode(ctx context.Context, target, code, usage string) (bool, error) {
	codeKey := fmt.Sprintf(codeCacheKey, usage, target)

	attemptsStr, err := cache.Client.HGet(ctx, codeKey, "attempts").Result()
	if err != nil {
		return false, errors.New("code expired or not found")
	}

	attempts := 0
	fmt.Sscanf(attemptsStr, "%d", &attempts)
	if attempts >= 5 {
		cache.Client.Del(ctx, codeKey)
		return false, errors.New("too many attempts, please request a new code")
	}

	cache.Client.HIncrBy(ctx, codeKey, "attempts", 1)

	storedCode, err := cache.Client.HGet(ctx, codeKey, "code").Result()
	if err != nil {
		return false, errors.New("code expired or not found")
	}

	if storedCode != code {
		return false, errors.New("invalid verification code")
	}

	cache.Client.Del(ctx, codeKey)
	s.markCodeUsed(target, usage)

	return true, nil
}

func (s *CodeService) saveVerificationCode(target, code, codeType, usage string) error {
	vc := &model.VerificationCode{
		Target:     target,
		Code:       code,
		Type:       codeType,
		Usage:      usage,
		ExpiresAt:  time.Now().Add(time.Duration(codeExpireTime) * time.Second),
		MaxAttempts: 5,
	}
	return database.DB.Create(vc).Error
}

func (s *CodeService) markCodeUsed(target, usage string) {
	database.DB.Model(&model.VerificationCode{}).
		Where("target = ? AND usage = ? AND is_used = ?", target, usage, false).
		Order("created_at DESC").
		Limit(1).
		Update("is_used", true)
}
