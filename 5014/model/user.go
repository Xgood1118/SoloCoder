package model

import "time"

type OnlineStatus int

const (
	Online OnlineStatus = iota
	Away
	Offline
)

func (s OnlineStatus) String() string {
	switch s {
	case Online:
		return "online"
	case Away:
		return "away"
	case Offline:
		return "offline"
	default:
		return "unknown"
	}
}

type User struct {
	ID        string       `json:"id"`
	Username  string       `json:"username"`
	Status    OnlineStatus `json:"status"`
	AwayAt    *time.Time   `json:"away_at,omitempty"`
	JoinedAt  time.Time    `json:"joined_at"`
}
