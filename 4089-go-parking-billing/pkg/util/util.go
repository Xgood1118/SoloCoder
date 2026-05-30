package util

import (
	"regexp"
	"strings"
)

var (
	regularPlate   = regexp.MustCompile(`^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{5}$`)
	newEnergyPlate = regexp.MustCompile(`^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][0-9]{6}$`)
	newEnergySmall = regexp.MustCompile(`^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9挂学警港澳]$`)
	embassyPlate   = regexp.MustCompile(`^使[A-Z0-9]{6}$`)
	hkMacaoPlate   = regexp.MustCompile(`^粤[Zz][A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9港澳]$`)
)

func ValidatePlate(plate string) bool {
	plate = strings.ToUpper(strings.TrimSpace(plate))
	if regularPlate.MatchString(plate) {
		return true
	}
	if newEnergyPlate.MatchString(plate) {
		return true
	}
	if newEnergySmall.MatchString(plate) {
		return true
	}
	if embassyPlate.MatchString(plate) {
		return true
	}
	if hkMacaoPlate.MatchString(plate) {
		return true
	}
	return false
}

func PlateType(plate string) string {
	plate = strings.ToUpper(strings.TrimSpace(plate))
	switch {
	case newEnergyPlate.MatchString(plate):
		return "new_energy"
	case newEnergySmall.MatchString(plate):
		return "new_energy"
	case embassyPlate.MatchString(plate):
		return "embassy"
	case hkMacaoPlate.MatchString(plate):
		return "hk_macao"
	default:
		return "regular"
	}
}

func CentsToYuan(cents int64) float64 {
	return float64(cents) / 100.0
}

func YuanToCents(yuan float64) int64 {
	return int64(yuan*100 + 0.5)
}
