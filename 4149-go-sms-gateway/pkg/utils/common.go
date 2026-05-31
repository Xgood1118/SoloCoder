package utils

import (
	"crypto/md5"
	"encoding/hex"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

func GenerateMessageID() string {
	return uuid.New().String()
}

func GenerateSimpleID() string {
	h := md5.New()
	h.Write([]byte(uuid.New().String()))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func GenerateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	rand.Seed(time.Now().UnixNano())
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

func MD5(s string) string {
	h := md5.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

func Retry(attempts int, sleep time.Duration, fn func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(sleep)
		sleep *= 2
	}
	return err
}

func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
