package models

import (
	"time"
)

type NodeType string

const (
	NodeTypeStart    NodeType = "start"
	NodeTypeApproval NodeType = "approval"
	NodeTypeCondition NodeType = "condition"
	NodeTypeEnd      NodeType = "end"
)

type ApprovalAction string

const (
	ActionApprove  ApprovalAction = "approve"
	ActionReject   ApprovalAction = "reject"
	ActionTransfer ApprovalAction = "transfer"
)

type TimeoutAction string

const (
	TimeoutAutoApprove TimeoutAction = "auto_approve"
	TimeoutAutoReject  TimeoutAction = "auto_reject"
	TimeoutReminder    TimeoutAction = "reminder"
)

type ConditionType string

const (
	ConditionAmount    ConditionType = "amount"
	ConditionTime      ConditionType = "time"
	ConditionVariable  ConditionType = "variable"
	ConditionExpression ConditionType = "expression"
)

type Operator string

const (
	OpEq    Operator = "eq"
	OpNe    Operator = "ne"
	OpGt    Operator = "gt"
	OpGte   Operator = "gte"
	OpLt    Operator = "lt"
	OpLte   Operator = "lte"
	OpAnd   Operator = "and"
	OpOr    Operator = "or"
)

type NotificationChannel string

const (
	ChannelInApp NotificationChannel = "inapp"
	ChannelEmail NotificationChannel = "email"
)

type InstanceStatus string

const (
	StatusPending   InstanceStatus = "pending"
	StatusRunning   InstanceStatus = "running"
	StatusSuspended InstanceStatus = "suspended"
	StatusApproved  InstanceStatus = "approved"
	StatusRejected  InstanceStatus = "rejected"
)

type Condition struct {
	ID         string        `json:"id"`
	Type       ConditionType `json:"type"`
	Field      string        `json:"field"`
	Operator   Operator      `json:"operator"`
	Value      interface{}   `json:"value"`
	Expression string        `json:"expression,omitempty"`
}

type TimeoutConfig struct {
	Duration time.Duration `json:"duration"`
	Action   TimeoutAction `json:"action"`
}

type Node struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Type           NodeType       `json:"type"`
	Approvers      []string       `json:"approvers"`
	Conditions     []Condition    `json:"conditions"`
	TimeoutConfig  *TimeoutConfig `json:"timeout_config,omitempty"`
	NextNodes      []string       `json:"next_nodes"`
	PositionX      float64        `json:"position_x"`
	PositionY      float64        `json:"position_y"`
}

type FlowDefinition struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Version     int       `json:"version"`
	Nodes       []Node    `json:"nodes"`
	StartNodeID string    `json:"start_node_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedBy   string    `json:"created_by"`
}

type ApprovalComment struct {
	ID         string         `json:"id"`
	InstanceID string         `json:"instance_id"`
	NodeID     string         `json:"node_id"`
	Approver   string         `json:"approver"`
	Action     ApprovalAction `json:"action"`
	Content    string         `json:"content"`
	CreatedAt  time.Time      `json:"created_at"`
}

type FlowInstance struct {
	ID              string            `json:"id"`
	FlowDefID       string            `json:"flow_def_id"`
	FlowDefVersion  int               `json:"flow_def_version"`
	Title           string            `json:"title"`
	Initiator       string            `json:"initiator"`
	CurrentNodeID   string            `json:"current_node_id"`
	Status          InstanceStatus    `json:"status"`
	Variables       map[string]interface{} `json:"variables"`
	Data            map[string]interface{} `json:"data"`
	SuspendedAt     *time.Time        `json:"suspended_at,omitempty"`
	NodeEnteredAt   time.Time         `json:"node_entered_at"`
	ApprovalPath    []string          `json:"approval_path"`
	TimeoutReminded bool              `json:"timeout_reminded"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}
