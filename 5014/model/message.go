package model

type MessageType int

const (
	MsgNormal MessageType = iota
	MsgSystem
	MsgBroadcast
)

func (t MessageType) String() string {
	switch t {
	case MsgNormal:
		return "normal"
	case MsgSystem:
		return "system"
	case MsgBroadcast:
		return "broadcast"
	default:
		return "unknown"
	}
}

type Reaction struct {
	UserID string `json:"user_id"`
	Emoji  string `json:"emoji"`
}

type Message struct {
	ID          string     `json:"id"`
	ChatroomID  string     `json:"chatroom_id"`
	UserID      string     `json:"user_id"`
	Username    string     `json:"username"`
	Type        MessageType `json:"type"`
	Content     string     `json:"content"`
	MentionIDs  []string   `json:"mention_ids,omitempty"`
	QuoteID     *string    `json:"quote_id,omitempty"`
	QuoteMsg    *string    `json:"quote_msg,omitempty"`
	Reactions   []Reaction `json:"reactions,omitempty"`
	CreatedAt   int64      `json:"created_at"`
}

type PaginatedMessages struct {
	Messages   []Message `json:"messages"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	PageSize   int       `json:"page_size"`
	HasMore    bool      `json:"has_more"`
}
