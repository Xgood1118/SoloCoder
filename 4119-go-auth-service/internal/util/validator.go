package util

import (
	"regexp"
	"strings"
)

var (
	phoneRegex   = regexp.MustCompile(`^1[3-9]\d{9}$`)
	emailRegex   = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	usernameRegex = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{3,19}$`)
)

func IsValidPhone(phone string) bool {
	return phoneRegex.MatchString(phone)
}

func IsValidEmail(email string) bool {
	if len(email) > 100 {
		return false
	}
	if !emailRegex.MatchString(email) {
		return false
	}
	localPart := email[:strings.Index(email, "@")]
	if strings.Contains(localPart, "..") {
		return false
	}
	if strings.HasPrefix(localPart, ".") || strings.HasSuffix(localPart, ".") {
		return false
	}
	return true
}

func IsValidUsername(username string) bool {
	if len(username) < 4 || len(username) > 20 {
		return false
	}
	return usernameRegex.MatchString(username)
}

func IsValidPassword(password string) bool {
	if len(password) < 8 || len(password) > 32 {
		return false
	}
	hasUpper := false
	hasLower := false
	hasDigit := false
	for _, c := range password {
		if c >= 'A' && c <= 'Z' {
			hasUpper = true
		} else if c >= 'a' && c <= 'z' {
			hasLower = true
		} else if c >= '0' && c <= '9' {
			hasDigit = true
		}
	}
	return hasUpper && hasLower && hasDigit
}

func GetAccountType(account string) string {
	if IsValidPhone(account) {
		return "phone"
	}
	if IsValidEmail(account) {
		return "email"
	}
	return "username"
}
