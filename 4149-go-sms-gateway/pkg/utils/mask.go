package utils

import (
	"regexp"
	"strings"
)

var (
	phoneRegexStrict = regexp.MustCompile(`^1[3-9]\d{9}$`)
	phoneRegex       = regexp.MustCompile(`1[3-9]\d{9}`)
	emailRegex       = regexp.MustCompile(`[\w.-]+@[\w.-]+\.\w+`)
	passwordRegex    = regexp.MustCompile(`(?i)(password|pwd|passwd|密码)\s*[=:：]\s*[^\s&，,]+`)
	idCardRegex      = regexp.MustCompile(`\d{17}[\dXx]|\d{15}`)
	bankCardRegex    = regexp.MustCompile(`\d{16,19}`)
)

func MaskPhone(phone string) string {
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

func MaskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return email
	}
	username := parts[0]
	domain := parts[1]
	
	if len(username) <= 2 {
		return username + "***@" + domain
	}
	return username[:2] + "***@" + domain
}

func MaskIDCard(idCard string) string {
	if len(idCard) < 8 {
		return idCard
	}
	if len(idCard) <= 10 {
		return idCard[:3] + "****" + idCard[len(idCard)-3:]
	}
	if len(idCard) <= 14 {
		maskLen := len(idCard) - 6
		mask := strings.Repeat("*", maskLen)
		return idCard[:3] + mask + idCard[len(idCard)-3:]
	}
	tailLen := 3
	if len(idCard) >= 18 {
		tailLen = 4
	}
	maskLen := len(idCard) - 6 - tailLen
	mask := strings.Repeat("*", maskLen)
	return idCard[:6] + mask + idCard[len(idCard)-tailLen:]
}

func MaskBankCard(bankCard string) string {
	if len(bankCard) < 8 {
		return bankCard
	}
	return bankCard[:4] + "********" + bankCard[len(bankCard)-4:]
}

func MaskSensitiveContent(content string) string {
	result := content
	
	result = passwordRegex.ReplaceAllStringFunc(result, func(match string) string {
		parts := regexp.MustCompile(`(?i)(password|pwd|passwd|密码)\s*[=:：]\s*`).FindStringIndex(match)
		if len(parts) == 2 {
			return match[:parts[1]] + "***"
		}
		return match
	})
	
	result = phoneRegex.ReplaceAllStringFunc(result, func(match string) string {
		if len(match) >= 7 {
			return match[:3] + "****" + match[len(match)-4:]
		}
		return match
	})
	result = emailRegex.ReplaceAllStringFunc(result, MaskEmail)
	result = idCardRegex.ReplaceAllStringFunc(result, MaskIDCard)
	result = bankCardRegex.ReplaceAllStringFunc(result, MaskBankCard)
	
	return result
}

func MaskTemplateVars(vars map[string]string) map[string]string {
	masked := make(map[string]string)
	for k, v := range vars {
		lowerKey := strings.ToLower(k)
		if strings.Contains(lowerKey, "password") || 
		   strings.Contains(lowerKey, "pwd") ||
		   strings.Contains(lowerKey, "code") {
			masked[k] = "***"
		} else {
			masked[k] = MaskSensitiveContent(v)
		}
	}
	return masked
}
