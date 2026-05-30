package utils

import (
	"encoding/csv"
	"encoding/json"
	"io"
	"strconv"
	"strings"
	"time"

	"snippet-manager/internal/model"
)

func ExportSnippetsToCSV(snippets []*model.Snippet) ([][]string, error) {
	records := [][]string{
		{"id", "title", "language", "code", "tags", "visibility", "library_type", "is_public", "creator_id", "team_id", "created_at", "updated_at"},
	}

	for _, s := range snippets {
		tagNames := make([]string, len(s.Tags))
		for i, tag := range s.Tags {
			tagNames[i] = tag.Name
		}
		tagsJSON, _ := json.Marshal(tagNames)

		records = append(records, []string{
			uintToString(s.ID),
			s.Title,
			s.Language,
			s.Code,
			string(tagsJSON),
			string(s.Visibility),
			string(s.LibraryType),
			boolToString(s.IsPublic),
			uintToString(s.CreatorID),
			uintToString(s.TeamID),
			s.CreatedAt.Format(time.RFC3339),
			s.UpdatedAt.Format(time.RFC3339),
		})
	}

	return records, nil
}

func WriteCSV(w io.Writer, records [][]string) error {
	writer := csv.NewWriter(w)
	writer.UseCRLF = true
	return writer.WriteAll(records)
}

func ImportSnippetsFromCSV(r io.Reader) ([]*model.Snippet, error) {
	reader := csv.NewReader(r)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, nil
	}

	var snippets []*model.Snippet
	for i := 1; i < len(records); i++ {
		record := records[i]
		if len(record) < 12 {
			continue
		}

		var tags []string
		if record[4] != "" {
			json.Unmarshal([]byte(record[4]), &tags)
		}

		snippet := &model.Snippet{
			Title:       record[1],
			Language:    record[2],
			Code:        record[3],
			Visibility:  model.SnippetVisibility(record[5]),
			LibraryType: model.LibraryType(record[6]),
			IsPublic:    record[7] == "true",
		}

		for _, tagName := range tags {
			snippet.Tags = append(snippet.Tags, model.Tag{Name: tagName})
		}

		snippets = append(snippets, snippet)
	}

	return snippets, nil
}

func ExportSnippetsToJSON(snippets []*model.Snippet) ([]byte, error) {
	type ExportSnippet struct {
		Title       string    `json:"title"`
		Language    string    `json:"language"`
		Code        string    `json:"code"`
		Tags        []string  `json:"tags"`
		Visibility  string    `json:"visibility"`
		LibraryType string    `json:"library_type"`
		IsPublic    bool      `json:"is_public"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	exportList := make([]ExportSnippet, len(snippets))
	for i, s := range snippets {
		tagNames := make([]string, len(s.Tags))
		for j, tag := range s.Tags {
			tagNames[j] = tag.Name
		}
		exportList[i] = ExportSnippet{
			Title:       s.Title,
			Language:    s.Language,
			Code:        s.Code,
			Tags:        tagNames,
			Visibility:  string(s.Visibility),
			LibraryType: string(s.LibraryType),
			IsPublic:    s.IsPublic,
			CreatedAt:   s.CreatedAt,
			UpdatedAt:   s.UpdatedAt,
		}
	}

	return json.MarshalIndent(exportList, "", "  ")
}

func ImportSnippetsFromJSON(data []byte) ([]*model.Snippet, error) {
	type ImportSnippet struct {
		Title       string   `json:"title"`
		Language    string   `json:"language"`
		Code        string   `json:"code"`
		Tags        []string `json:"tags"`
		Visibility  string   `json:"visibility"`
		LibraryType string   `json:"library_type"`
		IsPublic    bool     `json:"is_public"`
	}

	var importList []ImportSnippet
	if err := json.Unmarshal(data, &importList); err != nil {
		return nil, err
	}

	snippets := make([]*model.Snippet, len(importList))
	for i, imp := range importList {
		snippet := &model.Snippet{
			Title:       imp.Title,
			Language:    imp.Language,
			Code:        imp.Code,
			IsPublic:    imp.IsPublic,
		}
		if imp.Visibility != "" {
			snippet.Visibility = model.SnippetVisibility(imp.Visibility)
		} else {
			snippet.Visibility = model.VisibilityPrivate
		}
		if imp.LibraryType != "" {
			snippet.LibraryType = model.LibraryType(imp.LibraryType)
		} else {
			snippet.LibraryType = model.LibraryPublic
		}

		for _, tagName := range imp.Tags {
			snippet.Tags = append(snippet.Tags, model.Tag{Name: tagName})
		}

		snippets[i] = snippet
	}

	return snippets, nil
}

func uintToString(n uint) string {
	return strconv.FormatUint(uint64(n), 10)
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

func ParseTags(tagsStr string) []string {
	if tagsStr == "" {
		return nil
	}
	parts := strings.Split(tagsStr, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
