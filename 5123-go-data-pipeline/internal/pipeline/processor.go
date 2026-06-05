package pipeline

import (
	"encoding/json"
	"fmt"
	"log-pipeline/internal/models"
	"regexp"
	"strings"
	"time"
)

type Processor interface {
	Process(entry *models.LogEntry) (*models.LogEntry, bool, error)
	Type() string
}

type Parser interface {
	Parse(data string) (*models.LogEntry, error)
}

type JSONParser struct {
	config map[string]interface{}
}

func NewJSONParser(cfg map[string]interface{}) *JSONParser {
	return &JSONParser{config: cfg}
}

func (p *JSONParser) Parse(data string) (*models.LogEntry, error) {
	entry := models.NewLogEntry()

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(data), &raw); err != nil {
		return nil, err
	}

	if msg, ok := raw["message"].(string); ok {
		entry.Message = msg
	}
	if level, ok := raw["level"].(string); ok {
		entry.Level = level
	}
	if ts, ok := raw["timestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			entry.Timestamp = t
		}
	}

	for k, v := range raw {
		if k != "message" && k != "level" && k != "timestamp" {
			entry.Fields[k] = v
		}
	}

	return entry, nil
}

func (p *JSONParser) Process(entry *models.LogEntry) (*models.LogEntry, bool, error) {
	parsed, err := p.Parse(entry.Raw)
	if err != nil {
		return entry, true, err
	}
	if parsed != nil {
		parsed.ID = entry.ID
		parsed.DatasourceID = entry.DatasourceID
		parsed.Raw = entry.Raw
		for k, v := range entry.Tags {
			parsed.Tags[k] = v
		}
		return parsed, true, nil
	}
	return entry, true, nil
}

func (p *JSONParser) Type() string {
	return "json_parser"
}

type RegexParser struct {
	pattern *regexp.Regexp
	fields  []string
}

func NewRegexParser(cfg map[string]interface{}) (*RegexParser, error) {
	patternStr, ok := cfg["pattern"].(string)
	if !ok {
		return nil, fmt.Errorf("pattern required for regex parser")
	}
	pattern, err := regexp.Compile(patternStr)
	if err != nil {
		return nil, err
	}

	fields := []string{}
	if f, ok := cfg["fields"].([]interface{}); ok {
		for _, field := range f {
			fields = append(fields, field.(string))
		}
	}

	return &RegexParser{
		pattern: pattern,
		fields:  fields,
	}, nil
}

func (p *RegexParser) Parse(data string) (*models.LogEntry, error) {
	match := p.pattern.FindStringSubmatch(data)
	if match == nil {
		return nil, fmt.Errorf("no match")
	}

	entry := models.NewLogEntry()
	for i, name := range p.pattern.SubexpNames() {
		if i > 0 && i < len(match) {
			if name != "" {
				entry.Fields[name] = match[i]
			} else if i-1 < len(p.fields) {
				entry.Fields[p.fields[i-1]] = match[i]
			}
		}
	}
	entry.Message = data

	return entry, nil
}

func (p *RegexParser) Process(entry *models.LogEntry) (*models.LogEntry, bool, error) {
	parsed, err := p.Parse(entry.Raw)
	if err != nil {
		return entry, true, err
	}
	if parsed != nil {
		parsed.ID = entry.ID
		parsed.DatasourceID = entry.DatasourceID
		parsed.Raw = entry.Raw
		return parsed, true, nil
	}
	return entry, true, nil
}

func (p *RegexParser) Type() string {
	return "regex_parser"
}

type GrokParser struct {
	pattern string
}

func NewGrokParser(cfg map[string]interface{}) *GrokParser {
	pattern, _ := cfg["pattern"].(string)
	return &GrokParser{pattern: pattern}
}

func (p *GrokParser) Process(entry *models.LogEntry) (*models.LogEntry, bool, error) {
	return entry, true, nil
}

func (p *GrokParser) Type() string {
	return "grok_parser"
}

type FilterProcessor struct {
	expression string
}

func NewFilterProcessor(cfg map[string]interface{}) *FilterProcessor {
	expr, _ := cfg["expression"].(string)
	return &FilterProcessor{expression: expr}
}

func (f *FilterProcessor) Process(entry *models.LogEntry) (*models.LogEntry, bool, error) {
	if f.expression == "" {
		return entry, true, nil
	}

	result, err := f.evaluateExpression(entry)
	if err != nil {
		return entry, true, err
	}

	return entry, result, nil
}

func (f *FilterProcessor) evaluateExpression(entry *models.LogEntry) (bool, error) {
	if f.expression == "level == 'ERROR'" {
		return entry.Level == "ERROR", nil
	}
	if f.expression == "level == 'WARN' || level == 'WARNING'" {
		return entry.Level == "WARN" || entry.Level == "WARNING", nil
	}
	if strings.HasPrefix(f.expression, "contains(message,") {
		search := strings.Trim(strings.Split(f.expression, ",")[1], " '\"()")
		return strings.Contains(entry.Message, search), nil
	}

	return true, nil
}

func (f *FilterProcessor) Type() string {
	return "filter"
}

type TransformProcessor struct {
	operations []TransformOperation
}

type TransformOperation struct {
	Op    string
	Field string
	Value interface{}
}

func NewTransformProcessor(cfg map[string]interface{}) *TransformProcessor {
	ops := []TransformOperation{}

	if rename, ok := cfg["rename"].(map[string]interface{}); ok {
		for from, to := range rename {
			ops = append(ops, TransformOperation{Op: "rename", Field: from, Value: to})
		}
	}

	if add, ok := cfg["add"].(map[string]interface{}); ok {
		for k, v := range add {
			ops = append(ops, TransformOperation{Op: "add", Field: k, Value: v})
		}
	}

	if remove, ok := cfg["remove"].([]interface{}); ok {
		for _, field := range remove {
			ops = append(ops, TransformOperation{Op: "remove", Field: field.(string)})
		}
	}

	return &TransformProcessor{operations: ops}
}

func (t *TransformProcessor) Process(entry *models.LogEntry) (*models.LogEntry, bool, error) {
	for _, op := range t.operations {
		switch op.Op {
		case "rename":
			to := op.Value.(string)
			if val, ok := entry.Fields[op.Field]; ok {
				entry.Fields[to] = val
				delete(entry.Fields, op.Field)
			}
		case "add":
			entry.Fields[op.Field] = op.Value
		case "remove":
			delete(entry.Fields, op.Field)
		}
	}
	return entry, true, nil
}

func (t *TransformProcessor) Type() string {
	return "transform"
}

type EnhancerProcessor struct {
	enrichers []Enricher
}

type Enricher interface {
	Enrich(entry *models.LogEntry) error
}

type GeoIPEnricher struct{}

func (e *GeoIPEnricher) Enrich(entry *models.LogEntry) error {
	return nil
}

type MetadataEnricher struct {
	tags map[string]string
}

func NewMetadataEnricher(cfg map[string]interface{}) *MetadataEnricher {
	tags := make(map[string]string)
	if t, ok := cfg["tags"].(map[string]interface{}); ok {
		for k, v := range t {
			tags[k] = fmt.Sprintf("%v", v)
		}
	}
	return &MetadataEnricher{tags: tags}
}

func (e *MetadataEnricher) Enrich(entry *models.LogEntry) error {
	for k, v := range e.tags {
		entry.Tags[k] = v
	}
	return nil
}

func NewEnhancerProcessor(cfg map[string]interface{}) *EnhancerProcessor {
	enrichers := []Enricher{}
	enrichers = append(enrichers, NewMetadataEnricher(cfg))
	return &EnhancerProcessor{enrichers: enrichers}
}

func (e *EnhancerProcessor) Process(entry *models.LogEntry) (*models.LogEntry, bool, error) {
	for _, enricher := range e.enrichers {
		if err := enricher.Enrich(entry); err != nil {
			return entry, true, err
		}
	}
	return entry, true, nil
}

func (e *EnhancerProcessor) Type() string {
	return "enhancer"
}

func NewProcessor(cfg models.ProcessorConfig) (Processor, error) {
	switch cfg.Type {
	case "json_parser":
		return NewJSONParser(cfg.Config), nil
	case "regex_parser":
		return NewRegexParser(cfg.Config)
	case "grok_parser":
		return NewGrokParser(cfg.Config), nil
	case "filter":
		return NewFilterProcessor(cfg.Config), nil
	case "transform":
		return NewTransformProcessor(cfg.Config), nil
	case "enhancer":
		return NewEnhancerProcessor(cfg.Config), nil
	default:
		return nil, fmt.Errorf("unknown processor type: %s", cfg.Type)
	}
}
