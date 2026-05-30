package model

import (
	"time"
)

type UserRole string

const (
	RoleAdmin    UserRole = "admin"
	RoleMember   UserRole = "member"
)

type SnippetVisibility string

const (
	VisibilityPublic  SnippetVisibility = "public"
	VisibilityPrivate SnippetVisibility = "private"
)

type LibraryType string

const (
	LibraryPublic  LibraryType = "public"
	LibraryPrivate LibraryType = "private"
)

var SupportedLanguages = []string{
	"Go", "Python", "Java", "JavaScript", "TypeScript",
	"Rust", "C++", "C#", "Ruby", "PHP", "SQL", "Shell",
}

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Email     string    `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	Role      UserRole  `gorm:"size:20;default:member" json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Teams     []Team    `gorm:"many2many:team_members;" json:"teams,omitempty"`
}

type Team struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"uniqueIndex;size:100;not null" json:"name"`
	Description  string    `gorm:"size:500" json:"description"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Members      []User    `gorm:"many2many:team_members;" json:"members,omitempty"`
	Snippets     []Snippet `json:"snippets,omitempty"`
}

type TeamMember struct {
	TeamID    uint      `gorm:"primaryKey" json:"team_id"`
	UserID    uint      `gorm:"primaryKey" json:"user_id"`
	Role      UserRole  `gorm:"size:20;default:member" json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Snippet struct {
	ID            uint              `gorm:"primaryKey" json:"id"`
	TeamID        uint              `gorm:"index;not null" json:"team_id"`
	CreatorID     uint              `gorm:"index;not null" json:"creator_id"`
	Creator       *User             `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	Title         string            `gorm:"size:200;not null" json:"title"`
	Language      string            `gorm:"size:50;not null" json:"language"`
	Code          string            `gorm:"type:text;not null" json:"code"`
	Tags          []Tag             `gorm:"many2many:snippet_tags;" json:"tags,omitempty"`
	Visibility    SnippetVisibility `gorm:"size:20;default:private" json:"visibility"`
	LibraryType   LibraryType       `gorm:"size:20;default:public" json:"library_type"`
	ReferenceCount int              `gorm:"default:0" json:"reference_count"`
	IsPublic      bool              `gorm:"default:false" json:"is_public"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	Versions      []SnippetVersion  `json:"versions,omitempty"`
	Comments      []Comment         `json:"comments,omitempty"`
	References    []SnippetReference `gorm:"foreignKey:SourceID" json:"references,omitempty"`
	ReferencedBy  []SnippetReference `gorm:"foreignKey:TargetID" json:"referenced_by,omitempty"`
}

type Tag struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;size:50;not null" json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Snippets  []Snippet `gorm:"many2many:snippet_tags;" json:"snippets,omitempty"`
}

type SnippetTag struct {
	SnippetID uint `gorm:"primaryKey" json:"snippet_id"`
	TagID     uint `gorm:"primaryKey" json:"tag_id"`
}

type SnippetVersion struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	SnippetID  uint      `gorm:"index;not null" json:"snippet_id"`
	Version    int       `gorm:"not null" json:"version"`
	Code       string    `gorm:"type:text;not null" json:"code"`
	ModifierID uint      `gorm:"index;not null" json:"modifier_id"`
	Modifier   *User     `gorm:"foreignKey:ModifierID" json:"modifier,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type Comment struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	SnippetID  uint      `gorm:"index;not null" json:"snippet_id"`
	AuthorID   uint      `gorm:"index;not null" json:"author_id"`
	Author     *User     `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Content    string    `gorm:"type:text;not null" json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}

type Favorite struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"index:idx_user_snippet,unique;not null" json:"user_id"`
	SnippetID  uint      `gorm:"index:idx_user_snippet,unique;not null" json:"snippet_id"`
	Snippet    *Snippet  `gorm:"foreignKey:SnippetID" json:"snippet,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type SnippetReference struct {
	ID          uint     `gorm:"primaryKey" json:"id"`
	SourceID    uint     `gorm:"index;not null" json:"source_id"`
	Source      *Snippet `gorm:"foreignKey:SourceID" json:"source,omitempty"`
	TargetID    uint     `gorm:"index;not null" json:"target_id"`
	Target      *Snippet `gorm:"foreignKey:TargetID" json:"target,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type LanguageStat struct {
	Language string `json:"language"`
	Count    int64  `json:"count"`
}

type SnippetPreview struct {
	ID            uint              `json:"id"`
	Title         string            `json:"title"`
	Language      string            `json:"language"`
	CodePreview   string            `json:"code_preview"`
	Tags          []Tag             `json:"tags,omitempty"`
	Visibility    SnippetVisibility `json:"visibility"`
	LibraryType   LibraryType       `json:"library_type"`
	IsPublic      bool              `json:"is_public"`
	ReferenceCount int              `json:"reference_count"`
	CreatorID     uint              `json:"creator_id"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

type PaginatedResponse struct {
	Items      interface{} `json:"items"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}
