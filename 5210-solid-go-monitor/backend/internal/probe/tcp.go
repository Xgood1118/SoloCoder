package probe

import (
	"net"
	"time"

	"solid-go-monitor/internal/model"
)

func CheckTCP(target string, timeout int) (*model.ProbeResult, string) {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", target, time.Duration(timeout)*time.Second)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		result := model.NewProbeResult("", model.ProbeStatusDown, elapsed, err.Error())
		return result, err.Error()
	}
	defer conn.Close()

	result := model.NewProbeResult("", model.ProbeStatusUp, elapsed, "")
	return result, ""
}
