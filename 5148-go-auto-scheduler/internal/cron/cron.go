package cron

import (
	"fmt"
	"strings"
	"time"

	cronlib "github.com/robfig/cron/v3"
	"github.com/scheduler/go-auto-scheduler/internal/models"
)

type Parser struct {
	parser6 cronlib.Parser
	parser5 cronlib.Parser
}

func NewParser() *Parser {
	return &Parser{
		parser6: cronlib.NewParser(cronlib.Second | cronlib.Minute | cronlib.Hour | cronlib.Dom | cronlib.Month | cronlib.Dow),
		parser5: cronlib.NewParser(cronlib.Minute | cronlib.Hour | cronlib.Dom | cronlib.Month | cronlib.Dow),
	}
}

func (p *Parser) DetectFormat(expr string) (int, error) {
	expr = strings.TrimSpace(expr)
	if expr == "" {
		return 0, fmt.Errorf("cron expression is empty")
	}

	fields := strings.Fields(expr)
	if len(fields) == 5 {
		return 5, nil
	} else if len(fields) == 6 {
		return 6, nil
	}

	return 0, fmt.Errorf("invalid cron expression: expected 5 or 6 fields, got %d", len(fields))
}

func (p *Parser) ConvertTo6(expr string) (string, error) {
	format, err := p.DetectFormat(expr)
	if err != nil {
		return "", err
	}

	if format == 6 {
		if _, err := p.parser6.Parse(expr); err != nil {
			return "", fmt.Errorf("invalid 6-field cron expression: %w", err)
		}
		return expr, nil
	}

	if _, err := p.parser5.Parse(expr); err != nil {
		return "", fmt.Errorf("invalid 5-field cron expression: %w", err)
	}

	return "0 " + expr, nil
}

func (p *Parser) Validate(expr string) error {
	_, err := p.ConvertTo6(expr)
	return err
}

func (p *Parser) Parse(expr string) (cronlib.Schedule, error) {
	normalized, err := p.ConvertTo6(expr)
	if err != nil {
		return nil, err
	}
	return p.parser6.Parse(normalized)
}

func (p *Parser) GetNextTimes(expr string, count int, from time.Time) (*models.CronPreviewResponse, error) {
	if count <= 0 {
		count = 5
	}
	if count > 20 {
		count = 20
	}

	normalized, err := p.ConvertTo6(expr)
	if err != nil {
		return &models.CronPreviewResponse{
			Valid: false,
			Error: err.Error(),
		}, nil
	}

	schedule, err := p.parser6.Parse(normalized)
	if err != nil {
		return &models.CronPreviewResponse{
			Valid: false,
			Error: fmt.Sprintf("failed to parse cron: %v", err),
		}, nil
	}

	times := make([]time.Time, 0, count)
	current := from

	for i := 0; i < count; i++ {
		next := schedule.Next(current)
		if next.IsZero() {
			break
		}
		times = append(times, next)
		current = next
	}

	return &models.CronPreviewResponse{
		Valid:      true,
		NextTimes:  times,
		Normalized: normalized,
	}, nil
}

func (p *Parser) Preview(expr string, count int) *models.CronPreviewResponse {
	resp, err := p.GetNextTimes(expr, count, time.Now())
	if err != nil {
		return &models.CronPreviewResponse{
			Valid: false,
			Error: err.Error(),
		}
	}
	return resp
}

func (p *Parser) Next(expr string) (time.Time, error) {
	schedule, err := p.Parse(expr)
	if err != nil {
		return time.Time{}, err
	}
	return schedule.Next(time.Now()), nil
}

func FormatField(field string, min, max int, names map[int]string) error {
	if field == "*" {
		return nil
	}

	if strings.Contains(field, ",") {
		parts := strings.Split(field, ",")
		for _, part := range parts {
			if err := FormatField(part, min, max, names); err != nil {
				return err
			}
		}
		return nil
	}

	if strings.Contains(field, "/") {
		parts := strings.SplitN(field, "/", 2)
		if err := FormatField(parts[0], min, max, names); err != nil {
			return err
		}
		return nil
	}

	if strings.Contains(field, "-") {
		parts := strings.SplitN(field, "-", 2)
		for _, part := range parts {
			if err := FormatField(part, min, max, names); err != nil {
				return err
			}
		}
		return nil
	}

	if strings.HasPrefix(field, "@") {
		valid := map[string]bool{
			"@yearly":   true,
			"@annually": true,
			"@monthly":  true,
			"@weekly":   true,
			"@daily":    true,
			"@hourly":   true,
			"@every":    true,
		}
		if !valid[field] {
			return fmt.Errorf("invalid special expression: %s", field)
		}
		return nil
	}

	val, err := parseFieldValue(field, names)
	if err != nil {
		return err
	}

	if val < min || val > max {
		return fmt.Errorf("value %d out of range [%d, %d]", val, min, max)
	}

	return nil
}

func parseFieldValue(field string, names map[int]string) (int, error) {
	if names != nil {
		fieldLower := strings.ToLower(field)
		for val, name := range names {
			if strings.ToLower(name) == fieldLower {
				return val, nil
			}
		}
	}

	var val int
	if _, err := fmt.Sscanf(field, "%d", &val); err != nil {
		return 0, fmt.Errorf("invalid value: %s", field)
	}
	return val, nil
}

func (p *Parser) ValidateDetailed(expr string) error {
	format, err := p.DetectFormat(expr)
	if err != nil {
		return err
	}

	fields := strings.Fields(expr)

	monthNames := map[int]string{
		1: "jan", 2: "feb", 3: "mar", 4: "apr", 5: "may", 6: "jun",
		7: "jul", 8: "aug", 9: "sep", 10: "oct", 11: "nov", 12: "dec",
	}

	dowNames := map[int]string{
		0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
	}

	var startIdx int
	if format == 6 {
		if err := FormatField(fields[0], 0, 59, nil); err != nil {
			return fmt.Errorf("second field invalid: %w", err)
		}
		startIdx = 1
	} else {
		startIdx = 0
	}

	fieldValidators := []struct {
		field string
		min   int
		max   int
		names map[int]string
		name  string
	}{
		{fields[startIdx], 0, 59, nil, "minute"},
		{fields[startIdx+1], 0, 23, nil, "hour"},
		{fields[startIdx+2], 1, 31, nil, "day of month"},
		{fields[startIdx+3], 1, 12, monthNames, "month"},
		{fields[startIdx+4], 0, 6, dowNames, "day of week"},
	}

	for _, v := range fieldValidators {
		if err := FormatField(v.field, v.min, v.max, v.names); err != nil {
			return fmt.Errorf("%s field invalid: %w", v.name, err)
		}
	}

	return nil
}
