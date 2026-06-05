package utils

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

func GenerateID() string {
	return uuid.New().String()
}

func GenerateShortID() string {
	return fmt.Sprintf("%s", uuid.New().String()[:8])
}

func GenerateTimeWindowKey(window string, t time.Time) string {
	switch window {
	case "minute":
		return t.Format("200601021504")
	case "hour":
		return t.Format("2006010215")
	case "day":
		return t.Format("20060102")
	default:
		return t.Format("20060102150405")
	}
}
