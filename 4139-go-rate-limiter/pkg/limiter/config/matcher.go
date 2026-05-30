package config

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/solo/ratelimiter/pkg/limiter/dimension"
)

type RuleMatcher struct {
}

func NewRuleMatcher() *RuleMatcher {
	return &RuleMatcher{}
}

func (m *RuleMatcher) Match(ctx *dimension.RequestContext, rules []Rule) *RuleMatchResult {
	var bestMatch *RuleMatchResult

	for i := range rules {
		rule := &rules[i]
		if !rule.Enabled {
			continue
		}

		score := m.matchRule(ctx, rule)
		if score < 0 {
			continue
		}

		extractors := m.buildExtractors(rule)
		key, err := dimension.BuildKey(extractors, ctx)
		if err != nil || key == "" {
			continue
		}

		score += rule.Priority * 1000

		if bestMatch == nil || score > bestMatch.Score {
			bestMatch = &RuleMatchResult{
				Rule:       rule,
				Extractors: extractors,
				Key:        key,
				Score:      score,
			}
		}
	}

	return bestMatch
}

func (m *RuleMatcher) matchRule(ctx *dimension.RequestContext, rule *Rule) int {
	score := 0

	for _, matcher := range rule.Matchers {
		matched, matchScore := m.matchSingle(ctx, matcher)
		if !matched {
			return -1
		}
		score += matchScore
	}

	return score
}

func (m *RuleMatcher) matchSingle(ctx *dimension.RequestContext, matcher Matcher) (bool, int) {
	var value string
	switch matcher.Type {
	case MatcherPath:
		if ctx.Request != nil {
			value = ctx.Request.URL.Path
		} else {
			value = ctx.Path
		}
	case MatcherMethod:
		if ctx.Request != nil {
			value = ctx.Request.Method
		}
	case MatcherHost:
		if ctx.Request != nil {
			value = ctx.Request.Host
		}
	case MatcherHeader:
		if ctx.Request != nil {
			value = ctx.Request.Header.Get(matcher.Pattern)
		} else if ctx.Headers != nil {
			value = ctx.Headers[matcher.Pattern]
		}
	case MatcherQuery:
		if ctx.Request != nil {
			value = ctx.Request.URL.Query().Get(matcher.Pattern)
		} else if ctx.Query != nil {
			value = ctx.Query[matcher.Pattern]
		}

	case MatcherService:
		value = ctx.Service
	case MatcherRegion:
		value = ctx.Region
	case MatcherIP:
		value = ctx.IP
		if value == "" && ctx.Request != nil {
			value = dimension.GetClientIP(ctx.Request)
		}
	case MatcherUserID:
		value = ctx.UserID
	default:
		return false, 0
	}

	if matcher.IgnoreCase {
		value = strings.ToLower(value)
		matcher.Pattern = strings.ToLower(matcher.Pattern)
	}

	if matcher.Value != "" && value == matcher.Value {
		return true, 100
	}

	if matcher.Pattern == value {
		return true, 100
	}

	if strings.HasSuffix(matcher.Pattern, "/*") {
		prefix := strings.TrimSuffix(matcher.Pattern, "/*")
		if strings.HasPrefix(value, prefix) {
			if len(value) == len(prefix) || value[len(prefix)] == '/' {
				return true, 80
			}
		}
	}

	if strings.Contains(matcher.Pattern, "*") || strings.Contains(matcher.Pattern, "?") {
		matched, err := filepath.Match(matcher.Pattern, value)
		if err == nil && matched {
			return true, 60
		}
	}

	return false, 0
}

func (m *RuleMatcher) buildExtractors(rule *Rule) []dimension.Extractor {
	var extractors []dimension.Extractor

	for _, dimCfg := range rule.Dimensions {
		ext := m.createExtractor(dimCfg)
		if ext != nil {
			extractors = append(extractors, ext)
		}
	}

	return extractors
}

func (m *RuleMatcher) createExtractor(dimCfg DimensionConfig) dimension.Extractor {
	dim := dimension.Dimension{
		Type:    dimCfg.Type,
		Name:    dimCfg.Name,
		Pattern: dimCfg.Pattern,
	}
	ext, _ := dimension.NewExtractor(dim)
	return ext
}

func (m *RuleMatcher) MatchAll(ctx *dimension.RequestContext, rules []Rule) []RuleMatchResult {
	var matches []RuleMatchResult

	for i := range rules {
		rule := &rules[i]
		if !rule.Enabled {
			continue
		}

		score := m.matchRule(ctx, rule)
		if score < 0 {
			continue
		}

		extractors := m.buildExtractors(rule)
		key, err := dimension.BuildKey(extractors, ctx)
		if err != nil || key == "" {
			continue
		}

		matches = append(matches, RuleMatchResult{
			Rule:       rule,
			Extractors: extractors,
			Key:        key,
			Score:      score + rule.Priority*1000,
		})
	}

	return matches
}

func GetClientIP(r *http.Request) string {
	return dimension.GetClientIP(r)
}
