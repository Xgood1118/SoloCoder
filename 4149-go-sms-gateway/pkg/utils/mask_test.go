package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMaskPhone(t *testing.T) {
	tests := []struct {
		name     string
		phone    string
		expected string
	}{
		{"normal phone", "13800138000", "138****8000"},
		{"short phone", "12345", "12345"},
		{"exact 7 chars", "1234567", "123****4567"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskPhone(tt.phone)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMaskEmail(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		expected string
	}{
		{"normal email", "test@example.com", "te***@example.com"},
		{"short username", "a@example.com", "a***@example.com"},
		{"invalid email", "not-an-email", "not-an-email"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskEmail(tt.email)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMaskIDCard(t *testing.T) {
	tests := []struct {
		name     string
		idCard   string
		expected string
	}{
		{"18 digit id", "110101199001011234", "110101********1234"},
		{"15 digit id", "110101900101123", "110101******123"},
		{"16 digit id", "1101019001011123", "110101*******123"},
		{"short id", "12345", "12345"},
		{"8 digit id", "12345678", "123****678"},
		{"10 digit id", "1234567890", "123****890"},
		{"12 digit id", "123456789012", "123******012"},
		{"14 digit id", "12345678901234", "123********234"},
		{"16 digit bank-like", "1234567890123456", "123456*******456"},
		{"7 digit id", "1234567", "1234567"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskIDCard(tt.idCard)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMaskBankCard(t *testing.T) {
	tests := []struct {
		name     string
		card     string
		expected string
	}{
		{"16 digit card", "1234567890123456", "1234********3456"},
		{"19 digit card", "1234567890123456789", "1234********6789"},
		{"short card", "1234567", "1234567"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskBankCard(tt.card)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMaskSensitiveContent(t *testing.T) {
	content := "密码是123456，手机号13800138000"
	result := MaskSensitiveContent(content)
	assert.Contains(t, result, "***")
	assert.Contains(t, result, "138****8000")
}

func TestMaskTemplateVars(t *testing.T) {
	vars := map[string]string{
		"password": "secret123",
		"code":     "456789",
		"name":     "张三",
	}
	result := MaskTemplateVars(vars)
	assert.Equal(t, "***", result["password"])
	assert.Equal(t, "***", result["code"])
	assert.Equal(t, "张三", result["name"])
}
