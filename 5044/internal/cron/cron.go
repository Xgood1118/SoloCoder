package cron

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type CronMode int

const (
	ModeStandard CronMode = iota
	ModeExtended
)

type CronField struct {
	min      int
	max      int
	values   map[int]bool
	wildcard bool
}

type CronExpression struct {
	second     *CronField
	minute     *CronField
	hour       *CronField
	dayOfMonth *CronField
	month      *CronField
	dayOfWeek  *CronField
	year       *CronField
	mode       CronMode
	expression string
}

type CronParser struct {
	mode CronMode
}

func NewCronParser(mode CronMode) *CronParser {
	return &CronParser{mode: mode}
}

func (p *CronParser) Parse(expr string) (*CronExpression, error) {
	fields := strings.Fields(expr)
	expectedFields := 6
	if p.mode == ModeExtended {
		expectedFields = 7
	}

	if len(fields) != expectedFields {
		return nil, fmt.Errorf("invalid field count: expected %d, got %d", expectedFields, len(fields))
	}

	cronExpr := &CronExpression{
		mode:       p.mode,
		expression: expr,
	}

	var err error
	cronExpr.second, err = parseField(fields[0], 0, 59)
	if err != nil {
		return nil, fmt.Errorf("parse second failed: %w", err)
	}

	cronExpr.minute, err = parseField(fields[1], 0, 59)
	if err != nil {
		return nil, fmt.Errorf("parse minute failed: %w", err)
	}

	cronExpr.hour, err = parseField(fields[2], 0, 23)
	if err != nil {
		return nil, fmt.Errorf("parse hour failed: %w", err)
	}

	cronExpr.dayOfMonth, err = parseField(fields[3], 1, 31)
	if err != nil {
		return nil, fmt.Errorf("parse day of month failed: %w", err)
	}

	cronExpr.month, err = parseField(fields[4], 1, 12)
	if err != nil {
		return nil, fmt.Errorf("parse month failed: %w", err)
	}

	cronExpr.dayOfWeek, err = parseField(fields[5], 0, 6)
	if err != nil {
		return nil, fmt.Errorf("parse day of week failed: %w", err)
	}

	if p.mode == ModeExtended {
		cronExpr.year, err = parseField(fields[6], 1970, 2099)
		if err != nil {
			return nil, fmt.Errorf("parse year failed: %w", err)
		}
	}

	if err := cronExpr.Validate(); err != nil {
		return nil, err
	}

	return cronExpr, nil
}

func parseField(field string, min, max int) (*CronField, error) {
	cf := &CronField{
		min:    min,
		max:    max,
		values: make(map[int]bool),
	}

	if field == "*" {
		cf.wildcard = true
		for i := min; i <= max; i++ {
			cf.values[i] = true
		}
		return cf, nil
	}

	if field == "?" {
		cf.wildcard = true
		for i := min; i <= max; i++ {
			cf.values[i] = true
		}
		return cf, nil
	}

	parts := strings.Split(field, ",")
	for _, part := range parts {
		if err := parsePart(part, cf, min, max); err != nil {
			return nil, err
		}
	}

	if len(cf.values) == 0 {
		return nil, fmt.Errorf("no valid values for field")
	}

	return cf, nil
}

func parsePart(part string, cf *CronField, min, max int) error {
	if strings.Contains(part, "/") {
		return parseStep(part, cf, min, max)
	}

	if strings.Contains(part, "-") {
		return parseRange(part, cf, min, max)
	}

	if strings.HasSuffix(part, "L") {
		return parseLastDay(part, cf, min, max)
	}

	if strings.Contains(part, "W") {
		return parseWeekday(part, cf, min, max)
	}

	if strings.Contains(part, "#") {
		return parseNthWeekday(part, cf, min, max)
	}

	val, err := strconv.Atoi(part)
	if err != nil {
		return fmt.Errorf("invalid value: %s", part)
	}

	if val < min || val > max {
		return fmt.Errorf("value %d out of range [%d, %d]", val, min, max)
	}

	cf.values[val] = true
	return nil
}

func parseStep(part string, cf *CronField, min, max int) error {
	stepParts := strings.Split(part, "/")
	if len(stepParts) != 2 {
		return fmt.Errorf("invalid step format: %s", part)
	}

	rangePart := stepParts[0]
	stepStr := stepParts[1]

	step, err := strconv.Atoi(stepStr)
	if err != nil {
		return fmt.Errorf("invalid step value: %s", stepStr)
	}

	if step <= 0 {
		return fmt.Errorf("step must be positive: %d", step)
	}

	var start, end int
	if rangePart == "*" {
		start = min
		end = max
	} else if strings.Contains(rangePart, "-") {
		rangeParts := strings.Split(rangePart, "-")
		start, err = strconv.Atoi(rangeParts[0])
		if err != nil {
			return fmt.Errorf("invalid range start: %s", rangeParts[0])
		}
		end, err = strconv.Atoi(rangeParts[1])
		if err != nil {
			return fmt.Errorf("invalid range end: %s", rangeParts[1])
		}
	} else {
		start, err = strconv.Atoi(rangePart)
		if err != nil {
			return fmt.Errorf("invalid range start: %s", rangePart)
		}
		end = max
	}

	if start < min || end > max || start > end {
		return fmt.Errorf("invalid range [%d, %d]", start, end)
	}

	for i := start; i <= end; i += step {
		cf.values[i] = true
	}

	return nil
}

func parseRange(part string, cf *CronField, min, max int) error {
	rangeParts := strings.Split(part, "-")
	if len(rangeParts) != 2 {
		return fmt.Errorf("invalid range format: %s", part)
	}

	start, err := strconv.Atoi(rangeParts[0])
	if err != nil {
		return fmt.Errorf("invalid range start: %s", rangeParts[0])
	}

	end, err := strconv.Atoi(rangeParts[1])
	if err != nil {
		return fmt.Errorf("invalid range end: %s", rangeParts[1])
	}

	if start < min || end > max || start > end {
		return fmt.Errorf("invalid range [%d, %d] out of [%d, %d]", start, end, min, max)
	}

	for i := start; i <= end; i++ {
		cf.values[i] = true
	}

	return nil
}

func parseLastDay(part string, cf *CronField, min, max int) error {
	if part == "L" {
		for i := min; i <= max; i++ {
			cf.values[i] = true
		}
		cf.wildcard = true
		return nil
	}

	if strings.HasPrefix(part, "L") {
		offsetStr := strings.TrimPrefix(part, "L")
		_, err := strconv.Atoi(offsetStr)
		if err != nil {
			return fmt.Errorf("invalid L offset: %s", offsetStr)
		}
		for i := min; i <= max; i++ {
			cf.values[i] = true
		}
		cf.wildcard = true
		return nil
	}

	return fmt.Errorf("invalid L format: %s", part)
}

func parseWeekday(part string, cf *CronField, min, max int) error {
	dayStr := strings.TrimSuffix(part, "W")
	day, err := strconv.Atoi(dayStr)
	if err != nil {
		return fmt.Errorf("invalid weekday value: %s", dayStr)
	}

	if day < min || day > max {
		return fmt.Errorf("weekday %d out of range [%d, %d]", day, min, max)
	}

	for i := min; i <= max; i++ {
		cf.values[i] = true
	}
	cf.wildcard = true
	return nil
}

func parseNthWeekday(part string, cf *CronField, min, max int) error {
	nthParts := strings.Split(part, "#")
	if len(nthParts) != 2 {
		return fmt.Errorf("invalid # format: %s", part)
	}

	day, err := strconv.Atoi(nthParts[0])
	if err != nil {
		return fmt.Errorf("invalid day value: %s", nthParts[0])
	}

	n, err := strconv.Atoi(nthParts[1])
	if err != nil {
		return fmt.Errorf("invalid nth value: %s", nthParts[1])
	}

	if day < min || day > max {
		return fmt.Errorf("day %d out of range [%d, %d]", day, min, max)
	}

	if n < 1 || n > 5 {
		return fmt.Errorf("nth %d out of range [1, 5]", n)
	}

	for i := min; i <= max; i++ {
		cf.values[i] = true
	}
	cf.wildcard = true
	return nil
}

func (ce *CronExpression) Validate() error {
	if ce.second == nil || len(ce.second.values) == 0 {
		return fmt.Errorf("second field is invalid")
	}
	if ce.minute == nil || len(ce.minute.values) == 0 {
		return fmt.Errorf("minute field is invalid")
	}
	if ce.hour == nil || len(ce.hour.values) == 0 {
		return fmt.Errorf("hour field is invalid")
	}
	if ce.dayOfMonth == nil || len(ce.dayOfMonth.values) == 0 {
		return fmt.Errorf("day of month field is invalid")
	}
	if ce.month == nil || len(ce.month.values) == 0 {
		return fmt.Errorf("month field is invalid")
	}
	if ce.dayOfWeek == nil || len(ce.dayOfWeek.values) == 0 {
		return fmt.Errorf("day of week field is invalid")
	}
	if ce.mode == ModeExtended && (ce.year == nil || len(ce.year.values) == 0) {
		return fmt.Errorf("year field is invalid")
	}
	return nil
}

func (ce *CronExpression) Next(from time.Time) time.Time {
	t := from.Add(time.Second).Truncate(time.Second)
	endYear := 2100
	if ce.mode == ModeExtended {
		for y := range ce.year.values {
			if y > endYear {
				endYear = y
			}
		}
	}

	for t.Year() <= endYear {
		if !ce.month.values[int(t.Month())] {
			t = time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, t.Location())
			continue
		}

		if !ce.dayOfMonth.values[t.Day()] || !ce.dayOfWeek.values[int(t.Weekday())] {
			t = time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, t.Location())
			continue
		}

		if ce.mode == ModeExtended && !ce.year.values[t.Year()] {
			t = time.Date(t.Year()+1, 1, 1, 0, 0, 0, 0, t.Location())
			continue
		}

		if !ce.hour.values[t.Hour()] {
			t = t.Add(time.Hour).Truncate(time.Hour)
			continue
		}

		if !ce.minute.values[t.Minute()] {
			t = t.Add(time.Minute).Truncate(time.Minute)
			continue
		}

		if !ce.second.values[t.Second()] {
			t = t.Add(time.Second)
			continue
		}

		return t
	}

	return time.Time{}
}

func (ce *CronExpression) NextN(from time.Time, n int) []time.Time {
	times := make([]time.Time, 0, n)
	current := from
	for i := 0; i < n; i++ {
		next := ce.Next(current)
		if next.IsZero() {
			break
		}
		times = append(times, next)
		current = next
	}
	return times
}

func (ce *CronExpression) String() string {
	return ce.expression
}

func (ce *CronExpression) Mode() CronMode {
	return ce.mode
}
