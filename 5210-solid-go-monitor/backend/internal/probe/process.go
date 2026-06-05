package probe

import (
	"time"

	"github.com/shirou/gopsutil/v3/process"

	"solid-go-monitor/internal/model"
)

func CheckProcess(target string, timeout int) (*model.ProbeResult, string) {
	start := time.Now()

	processes, err := process.Processes()
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		result := model.NewProbeResult("", model.ProbeStatusDown, elapsed, err.Error())
		return result, err.Error()
	}

	var found *process.Process
	for _, p := range processes {
		name, err := p.Name()
		if err == nil && name == target {
			found = p
			break
		}
	}

	if found == nil {
		result := model.NewProbeResult("", model.ProbeStatusDown, elapsed, "Process not found: "+target)
		return result, result.ErrorMessage
	}

	cpuPercent, _ := found.CPUPercent()
	memPercent, _ := found.MemoryPercent()

	result := model.NewProbeResult("", model.ProbeStatusUp, elapsed, "")
	result.CPUPercent = cpuPercent
	result.MemoryPercent = float64(memPercent)

	return result, ""
}
