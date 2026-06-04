package model

type ChatroomType int

const (
	ChatroomOpen ChatroomType = iota
	ChatroomClosed
)

func (t ChatroomType) String() string {
	switch t {
	case ChatroomOpen:
		return "open"
	case ChatroomClosed:
		return "closed"
	default:
		return "unknown"
	}
}

type ChatroomStatus int

const (
	ChatroomActive ChatroomStatus = iota
	ChatroomShutdown
)

func (s ChatroomStatus) String() string {
	switch s {
	case ChatroomActive:
		return "active"
	case ChatroomShutdown:
		return "shutdown"
	default:
		return "unknown"
	}
}

type Chatroom struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Type        ChatroomType    `json:"type"`
	Status      ChatroomStatus  `json:"status"`
	CreatorID   string          `json:"creator_id"`
	CreatedAt   int64           `json:"created_at"`
}
