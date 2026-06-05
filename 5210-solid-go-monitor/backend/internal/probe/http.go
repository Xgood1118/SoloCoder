package probe

import (
	"net/http"
	"time"

	"solid-go-monitor/internal/model"
)

func CheckHTTP(target string, timeout int) (*model.ProbeResult, string) {
	start := time.Now()
	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
	}

	resp, err := client.Get(target)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		result := model.NewProbeResult("", model.ProbeStatusDown, elapsed, err.Error())
		return result, err.Error()
	}
	defer resp.Body.Close()

	result := model.NewProbeResult("", model.ProbeStatusUp, elapsed, "")
	result.HTTPStatus = resp.StatusCode

	if resp.StatusCode >= 400 {
		result.Status = model.ProbeStatusDown
		result.ErrorMessage = "HTTP status: " + resp.Status
		return result, result.ErrorMessage
	}

	return result, ""
}
