package search

import (
	"strings"
	"unicode"
)

type SearchResult struct {
	ID         uint
	Relevance  float64
	MatchTitle bool
	MatchTags  bool
	MatchCode  bool
}

func FuzzySearch(keyword string, snippets []FuzzySearchable) []SearchResult {
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	if keyword == "" {
		return nil
	}

	keywordTokens := tokenize(keyword)
	var results []SearchResult

	for _, s := range snippets {
		result := calculateRelevance(keyword, keywordTokens, s)
		if result.Relevance > 0 {
			results = append(results, result)
		}
	}

	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Relevance > results[i].Relevance {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	return results
}

type FuzzySearchable interface {
	GetID() uint
	GetTitle() string
	GetTags() []string
	GetCode() string
}

func calculateRelevance(keyword string, keywordTokens []string, s FuzzySearchable) SearchResult {
	result := SearchResult{ID: s.GetID()}

	title := strings.ToLower(s.GetTitle())
	tags := s.GetTags()
	for i := range tags {
		tags[i] = strings.ToLower(tags[i])
	}
	code := strings.ToLower(s.GetCode())

	titleScore := 0.0
	if strings.Contains(title, keyword) {
		titleScore = 5.0
		result.MatchTitle = true
	} else {
		for _, token := range keywordTokens {
			if strings.Contains(title, token) {
				titleScore += 2.0
				result.MatchTitle = true
			}
		}
	}

	tagScore := 0.0
	for _, tag := range tags {
		if strings.Contains(tag, keyword) {
			tagScore += 3.0
			result.MatchTags = true
			break
		}
	}
	if !result.MatchTags {
		for _, token := range keywordTokens {
			for _, tag := range tags {
				if strings.Contains(tag, token) {
					tagScore += 1.0
					result.MatchTags = true
				}
			}
		}
	}

	codeScore := 0.0
	if strings.Contains(code, keyword) {
		codeScore = 1.0
		result.MatchCode = true
	} else {
		for _, token := range keywordTokens {
			if strings.Contains(code, token) {
				codeScore += 0.5
				result.MatchCode = true
			}
		}
	}

	result.Relevance = titleScore + tagScore + codeScore
	return result
}

func tokenize(text string) []string {
	var tokens []string
	var current strings.Builder

	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			current.WriteRune(r)
		} else {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
		}
	}

	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}

	return tokens
}

func GetCodePreview(code string, maxLines int) string {
	lines := strings.Split(code, "\n")
	if len(lines) <= maxLines {
		return code
	}
	return strings.Join(lines[:maxLines], "\n") + "\n..."
}
