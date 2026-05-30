package utils

import (
	"errors"
	"snippet-manager/internal/model"
	"strings"
)

func ValidateLanguage(language string) error {
	for _, lang := range model.SupportedLanguages {
		if strings.EqualFold(language, lang) {
			return nil
		}
	}
	return errors.New("unsupported language: " + language)
}

func TruncateCode(code string, maxLength int) string {
	if maxLength <= 0 || len(code) <= maxLength {
		return code
	}
	return code[:maxLength] + "\n... [truncated]"
}

func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
