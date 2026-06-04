package model

import "time"

type MemberRole int

const (
	RoleMember MemberRole = iota
	RoleAdmin
)

func (r MemberRole) String() string {
	switch r {
	case RoleAdmin:
		return "admin"
	default:
		return "member"
	}
}

type Member struct {
	UserID     string       `json:"user_id"`
	ChatroomID string       `json:"chatroom_id"`
	Role       MemberRole   `json:"role"`
	JoinedAt   time.Time    `json:"joined_at"`
	Muted      bool         `json:"muted"`
	MuteUntil  *time.Time   `json:"mute_until,omitempty"`
}

func (m *Member) IsAdmin() bool {
	return m.Role == RoleAdmin
}

func (m *Member) IsMutedNow() bool {
	if !m.Muted {
		return false
	}
	if m.MuteUntil == nil {
		return true
	}
	return time.Now().Before(*m.MuteUntil)
}

type JoinRequest struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	ChatroomID string    `json:"chatroom_id"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

const (
	JoinPending  = "pending"
	JoinApproved = "approved"
	JoinRejected = "rejected"
)
