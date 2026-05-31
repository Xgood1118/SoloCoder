package risk

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
)

var (
	chineseNumMap = map[rune]int{
		'零': 0, '〇': 0, '一': 1, '壹': 1, '二': 2, '贰': 2, '两': 2,
		'三': 3, '叁': 3, '四': 4, '肆': 4, '五': 5, '伍': 5,
		'六': 6, '陆': 6, '七': 7, '柒': 7, '八': 8, '捌': 8,
		'九': 9, '玖': 9,
	}
	unitMap = map[rune]int{
		'十': 10, '拾': 10,
		'百': 100, '佰': 100,
		'千': 1000, '仟': 1000,
		'万': 10000, '萬': 10000,
		'亿': 100000000, '億': 100000000,
	}
	chineseNumRegex = regexp.MustCompile(`[零〇一壹二贰两三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬亿億]+`)
)

type SensitiveWordFilter struct {
	root      *trieNode
	sensitiveWords []string
	mu        sync.RWMutex
}

type trieNode struct {
	children map[rune]*trieNode
	isEnd    bool
}

func NewSensitiveWordFilter(words []string) *SensitiveWordFilter {
	filter := &SensitiveWordFilter{
		root:           &trieNode{children: make(map[rune]*trieNode)},
		sensitiveWords: make([]string, 0),
	}
	filter.AddWords(words)
	return filter
}

func (f *SensitiveWordFilter) AddWord(word string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.sensitiveWords = append(f.sensitiveWords, word)
	node := f.root
	for _, ch := range []rune(word) {
		if node.children[ch] == nil {
			node.children[ch] = &trieNode{children: make(map[rune]*trieNode)}
		}
		node = node.children[ch]
	}
	node.isEnd = true
}

func (f *SensitiveWordFilter) AddWords(words []string) {
	for _, word := range words {
		f.AddWord(word)
	}
}

func (f *SensitiveWordFilter) RemoveWord(word string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	for i, w := range f.sensitiveWords {
		if w == word {
			f.sensitiveWords = append(f.sensitiveWords[:i], f.sensitiveWords[i+1:]...)
			break
		}
	}
	f.rebuildTrie()
}

func (f *SensitiveWordFilter) rebuildTrie() {
	f.root = &trieNode{children: make(map[rune]*trieNode)}
	for _, word := range f.sensitiveWords {
		node := f.root
		for _, ch := range []rune(word) {
			if node.children[ch] == nil {
				node.children[ch] = &trieNode{children: make(map[rune]*trieNode)}
			}
			node = node.children[ch]
		}
		node.isEnd = true
	}
}

func (f *SensitiveWordFilter) Check(content string) (bool, []string) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	normalizedContent := normalizeChineseNumbersExpanded(content)
	runes := []rune(normalizedContent)
	foundWords := make([]string, 0)
	wordSet := make(map[string]bool)

	for i := 0; i < len(runes); i++ {
		node := f.root
		matchLen := 0
		for j := i; j < len(runes); j++ {
			ch := runes[j]
			if node.children[ch] == nil {
				break
			}
			node = node.children[ch]
			matchLen++
			if node.isEnd {
				word := string(runes[i : i+matchLen])
				if !wordSet[word] {
					wordSet[word] = true
					foundWords = append(foundWords, word)
				}
			}
		}
	}

	return len(foundWords) > 0, foundWords
}

func (f *SensitiveWordFilter) Filter(content string, replaceChar rune) string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	normalizedContent := normalizeChineseNumbersExpanded(content)
	runes := []rune(normalizedContent)
	result := make([]rune, len(runes))
	copy(result, runes)

	for i := 0; i < len(runes); i++ {
		node := f.root
		matchLen := 0
		for j := i; j < len(runes); j++ {
			ch := runes[j]
			if node.children[ch] == nil {
				break
			}
			node = node.children[ch]
			matchLen++
			if node.isEnd {
				for k := 0; k < matchLen; k++ {
					result[i+k] = replaceChar
				}
			}
		}
	}

	return string(result)
}

func (f *SensitiveWordFilter) GetWords() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	words := make([]string, len(f.sensitiveWords))
	copy(words, f.sensitiveWords)
	return words
}

type MultiLayerFilter struct {
	filters []*SensitiveWordFilter
	mu      sync.RWMutex
}

func NewMultiLayerFilter() *MultiLayerFilter {
	return &MultiLayerFilter{
		filters: make([]*SensitiveWordFilter, 0),
	}
}

func (f *MultiLayerFilter) AddFilter(filter *SensitiveWordFilter) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.filters = append(f.filters, filter)
}

func (f *MultiLayerFilter) Check(content string) (bool, []string) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	allFound := make([]string, 0)
	wordSet := make(map[string]bool)

	for _, filter := range f.filters {
		found, words := filter.Check(content)
		if found {
			for _, w := range words {
				if !wordSet[w] {
					wordSet[w] = true
					allFound = append(allFound, w)
				}
			}
		}
	}

	return len(allFound) > 0, allFound
}

func (f *MultiLayerFilter) Filter(content string, replaceChar rune) string {
	result := content
	for _, filter := range f.filters {
		result = filter.Filter(result, replaceChar)
	}
	return result
}

func chineseNumToArabic(s string) string {
	runes := []rune(s)
	n := len(runes)
	if n == 0 {
		return s
	}

	hasAnyUnit := false
	for _, ch := range runes {
		if _, ok := unitMap[ch]; ok {
			hasAnyUnit = true
			break
		}
	}

	if !hasAnyUnit {
		var result strings.Builder
		for _, ch := range runes {
			if num, ok := chineseNumMap[ch]; ok {
				result.WriteString(fmt.Sprintf("%d", num))
			} else {
				return s
			}
		}
		return result.String()
	}

	result := parseChineseNum(runes)
	if result >= 0 {
		return fmt.Sprintf("%d", result)
	}
	return s
}

func parseChineseNum(runes []rune) int {
	n := len(runes)
	if n == 0 {
		return -1
	}

	total := 0
	section := 0
	current := 0

	for i := 0; i < n; i++ {
		ch := runes[i]
		if num, ok := chineseNumMap[ch]; ok {
			current = current*10 + num
		} else if unit, ok := unitMap[ch]; ok {
			if unit == 10000 || unit == 100000000 {
				if current == 0 && section == 0 {
					current = 1
				}
				section += current
				total += section * unit
				section = 0
			} else {
				if current == 0 {
					current = 1
				}
				section += current * unit
			}
			current = 0
		} else {
			return -1
		}
	}
	section += current
	total += section

	return total
}

func normalizeChineseNumbers(content string) string {
	return chineseNumRegex.ReplaceAllStringFunc(content, func(match string) string {
		return chineseNumToArabic(match)
	})
}

func expandChineseNum(s string) string {
	runes := []rune(s)
	n := len(runes)
	if n == 0 {
		return s
	}

	hasBigUnit := false
	for _, ch := range runes {
		if unit, ok := unitMap[ch]; ok && (unit == 10000 || unit == 100000000) {
			hasBigUnit = true
			break
		}
	}

	if !hasBigUnit {
		return chineseNumToArabic(s)
	}

	var sections [][]rune
	start := 0
	for i := 0; i < n; i++ {
		if unit, ok := unitMap[runes[i]]; ok && (unit == 10000 || unit == 100000000) {
			sections = append(sections, runes[start:i+1])
			start = i + 1
		}
	}
	if start < n {
		sections = append(sections, runes[start:n])
	}

	var result strings.Builder
	for _, sec := range sections {
		val := parseChineseNum(sec)
		if val >= 0 {
			result.WriteString(fmt.Sprintf("%d", val))
		} else {
			result.WriteString(string(sec))
		}
	}
	return result.String()
}

func normalizeChineseNumbersExpanded(content string) string {
	return chineseNumRegex.ReplaceAllStringFunc(content, func(match string) string {
		return expandChineseNum(match)
	})
}

func ContainsSensitiveWords(content string, words []string) (bool, []string) {
	found := make([]string, 0)
	normalizedContent := normalizeChineseNumbers(strings.ToLower(content))
	expandedContent := normalizeChineseNumbersExpanded(strings.ToLower(content))
	for _, word := range words {
		normalizedWord := normalizeChineseNumbers(strings.ToLower(word))
		if strings.Contains(normalizedContent, normalizedWord) || strings.Contains(expandedContent, normalizedWord) {
			found = append(found, word)
		}
	}
	return len(found) > 0, found
}


