package model

import (
	"time"
)

type User struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Username     string    `gorm:"size:50;uniqueIndex" json:"username"`
	PasswordHash string    `gorm:"size:255" json:"-"`
	RealName     string    `gorm:"size:50" json:"real_name"`
	Email        string    `gorm:"size:100" json:"email"`
	Phone        string    `gorm:"size:20" json:"phone"`
	DepartmentID uint64    `json:"department_id"`
	Role         string    `gorm:"size:20;default:'employee'" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Department struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:100" json:"name"`
	ParentID  uint64    `json:"parent_id"`
	ManagerID uint64    `json:"manager_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WorkflowDefinition struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"size:100" json:"name"`
	Code        string    `gorm:"size:50;uniqueIndex" json:"code"`
	Description string    `json:"description"`
	Version     int       `gorm:"default:1" json:"version"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedBy   uint64    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Nodes       []WorkflowNode `gorm:"foreignKey:WorkflowID" json:"nodes,omitempty"`
}

type WorkflowNode struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkflowID      uint64    `json:"workflow_id"`
	NodeCode        string    `gorm:"size:50" json:"node_code"`
	NodeName        string    `gorm:"size:100" json:"node_name"`
	NodeType        string    `gorm:"size:20" json:"node_type"`
	ApprovalType    string    `gorm:"size:20;default:'single'" json:"approval_type"`
	ApprovalRoles   []string  `gorm:"type:text[]" json:"approval_roles"`
	ApprovalUserIDs []uint64  `gorm:"type:bigint[]" json:"approval_user_ids"`
	TimeoutHours    int       `gorm:"default:0" json:"timeout_hours"`
	TimeoutStrategy string    `gorm:"size:20;default:'notify'" json:"timeout_strategy"`
	SortOrder       int       `gorm:"default:0" json:"sort_order"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Conditions      []WorkflowCondition `gorm:"foreignKey:NodeID" json:"conditions,omitempty"`
}

type WorkflowCondition struct {
	ID             uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	NodeID         uint64    `json:"node_id"`
	ConditionType  string    `gorm:"size:30" json:"condition_type"`
	FieldName      string    `gorm:"size:50" json:"field_name"`
	Operator       string    `gorm:"size:20" json:"operator"`
	Value          string    `gorm:"size:255" json:"value"`
	TargetNodeCode string    `gorm:"size:50" json:"target_node_code"`
	SortOrder      int       `gorm:"default:0" json:"sort_order"`
	CreatedAt      time.Time `json:"created_at"`
}

type WorkflowEdge struct {
	ID             uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkflowID     uint64    `json:"workflow_id"`
	FromNodeCode   string    `gorm:"size:50" json:"from_node_code"`
	ToNodeCode     string    `gorm:"size:50" json:"to_node_code"`
	EdgeType       string    `gorm:"size:20;default:'normal'" json:"edge_type"`
	ConditionID    uint64    `json:"condition_id"`
	CreatedAt      time.Time `json:"created_at"`
}

type PurchaseApplication struct {
	ID             uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ApplicationNo  string     `gorm:"size:50;uniqueIndex" json:"application_no"`
	Title          string     `gorm:"size:200" json:"title"`
	ApplicantID    uint64     `json:"applicant_id"`
	DepartmentID   uint64     `json:"department_id"`
	TotalAmount    float64    `gorm:"type:decimal(15,2);default:0" json:"total_amount"`
	ApplicationType string    `gorm:"size:50" json:"application_type"`
	Description    string     `json:"description"`
	AttachmentURLs []string   `gorm:"type:text[]" json:"attachment_urls"`
	CurrentNodeCode string    `gorm:"size:50" json:"current_node_code"`
	Status         string     `gorm:"size:30;default:'pending'" json:"status"`
	WorkflowID     uint64     `json:"workflow_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	SubmittedAt    *time.Time `json:"submitted_at"`
	CompletedAt    *time.Time `json:"completed_at"`
	Applicant      *User      `gorm:"foreignKey:ApplicantID" json:"applicant,omitempty"`
	Items          []PurchaseItem `gorm:"foreignKey:ApplicationID" json:"items,omitempty"`
}

type PurchaseItem struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	ApplicationID uint64    `json:"application_id"`
	ItemName      string    `gorm:"size:200" json:"item_name"`
	Specification string    `gorm:"size:200" json:"specification"`
	Quantity      int       `gorm:"default:1" json:"quantity"`
	UnitPrice     float64   `gorm:"type:decimal(15,2);default:0" json:"unit_price"`
	TotalPrice    float64   `gorm:"type:decimal(15,2);default:0" json:"total_price"`
	Remark        string    `json:"remark"`
	CreatedAt     time.Time `json:"created_at"`
}

type ApprovalTask struct {
	ID              uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ApplicationID   uint64     `json:"application_id"`
	NodeCode        string     `gorm:"size:50" json:"node_code"`
	NodeName        string     `gorm:"size:100" json:"node_name"`
	ApproverID      uint64     `json:"approver_id"`
	ApprovalStatus  string     `gorm:"size:20;default:'pending'" json:"approval_status"`
	ApprovalOpinion string     `json:"approval_opinion"`
	ApprovedAt      *time.Time `json:"approved_at"`
	IsSignatory     bool       `gorm:"default:false" json:"is_signatory"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Approver        *User      `gorm:"foreignKey:ApproverID" json:"approver,omitempty"`
	Application     *PurchaseApplication `gorm:"foreignKey:ApplicationID" json:"application,omitempty"`
}

type ApprovalHistory struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	ApplicationID uint64    `json:"application_id"`
	NodeCode      string    `gorm:"size:50" json:"node_code"`
	NodeName      string    `gorm:"size:100" json:"node_name"`
	ApproverID    uint64    `json:"approver_id"`
	ApproverName  string    `gorm:"size:50" json:"approver_name"`
	Action        string    `gorm:"size:30" json:"action"`
	Opinion       string    `json:"opinion"`
	FromNodeCode  string    `gorm:"size:50" json:"from_node_code"`
	ToNodeCode    string    `gorm:"size:50" json:"to_node_code"`
	CreatedAt     time.Time `json:"created_at"`
}

type TimeoutMonitor struct {
	ID            uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ApplicationID uint64     `json:"application_id"`
	NodeCode      string     `gorm:"size:50" json:"node_code"`
	TimeoutAt     time.Time  `json:"timeout_at"`
	IsHandled     bool       `gorm:"default:false" json:"is_handled"`
	HandledAt     *time.Time `json:"handled_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type CreateApplicationRequest struct {
	Title           string         `json:"title" binding:"required"`
	ApplicationType string         `json:"application_type"`
	Description     string         `json:"description"`
	AttachmentURLs  []string       `json:"attachment_urls"`
	Items           []PurchaseItem `json:"items"`
}

type ApprovalRequest struct {
	ApplicationID uint64 `json:"application_id" binding:"required"`
	TaskID        uint64 `json:"task_id" binding:"required"`
	Action        string `json:"action" binding:"required"`
	Opinion       string `json:"opinion"`
}

type RollbackRequest struct {
	ApplicationID    uint64 `json:"application_id" binding:"required"`
	TargetNodeCode   string `json:"target_node_code" binding:"required"`
	Reason           string `json:"reason" binding:"required"`
}
