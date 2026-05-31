package risk

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChineseNumToArabic(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"simple num", "一", "1"},
		{"two digits", "十二", "12"},
		{"three digits", "一百二十三", "123"},
		{"four digits", "一千二百三十四", "1234"},
		{"with wan", "一万二千三百四十五", "12345"},
		{"with yi wan", "一万", "10000"},
		{"two wan", "贰万", "20000"},
		{"with two wan", "二十万", "200000"},
		{"capital two wan", "贰拾万", "200000"},
		{"with yi bai wan", "一百万", "1000000"},
		{"capital yi bai wan", "壹佰万", "1000000"},
		{"complex", "一亿二千三百四十五万六千七百八十九", "123456789"},
		{"capital nums series", "壹贰叁肆伍", "12345"},
		{"capital nums series 2", "零壹贰叁肆", "01234"},
		{"with liang", "两百", "200"},
		{"two thousand", "贰仟", "2000"},
		{"three hundred", "叁佰", "300"},
		{"four thousand", "肆仟", "4000"},
		{"five hundred", "伍佰", "500"},
		{"mixed 壹仟贰佰", "壹仟贰佰", "1200"},
		{"mixed 贰仟叁佰肆拾", "贰仟叁佰肆拾", "2340"},
		{"standalone 万", "万", "10000"},
		{"standalone 亿", "亿", "100000000"},
		{"十万", "十万", "100000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := chineseNumToArabic(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNormalizeChineseNumbers(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"simple", "赚一万元", "赚10000元"},
		{"multiple", "十二元和三十元", "12元和30元"},
		{"mixed", "100元和一万元", "100元和10000元"},
		{"no chinese num", "赚10000元", "赚10000元"},
		{"capital with unit", "赚贰仟元", "赚2000元"},
		{"capital series", "编号壹贰叁肆", "编号1234"},
		{"capital mixed", "壹仟贰佰元", "1200元"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeChineseNumbers(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSensitiveWordFilter_Check_ChineseNum(t *testing.T) {
	filter := NewSensitiveWordFilter([]string{"赚10000", "赌博", "诈骗", "赚2000"})

	tests := []struct {
		name    string
		content string
		want    bool
	}{
		{"arabic num match", "赚10000元", true},
		{"chinese num match", "赚一万元", true},
		{"capital chinese num match", "赚壹万元", true},
		{"no match", "正常内容", false},
		{"gambling match", "来赌博吧", true},
		{"two thousand capital", "赚贰仟元", true},
		{"two thousand chinese", "赚二千元", true},
		{"three hundred", "叁佰元", false},
		{"complex chinese match", "赚壹万贰仟元", true},
		{"one hundred wan", "赚壹佰万元", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _ := filter.Check(tt.content)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestContainsSensitiveWords_ChineseNum(t *testing.T) {
	words := []string{"赚10000", "赌博", "赚2000"}

	tests := []struct {
		name    string
		content string
		want    bool
	}{
		{"arabic num", "赚10000元", true},
		{"chinese num", "赚一万元", true},
		{"complex chinese", "赚壹万贰仟元", true},
		{"no match", "正常内容", false},
		{"two thousand capital", "赚贰仟元", true},
		{"capital series", "编号壹贰叁肆", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _ := ContainsSensitiveWords(tt.content, words)
			assert.Equal(t, tt.want, got)
		})
	}
}
