package model

import "time"

type Role string

const (
	RoleAdmin       Role = "admin"
	RoleSupervisor  Role = "supervisor"
	RoleSubordinate Role = "subordinate"
)

const (
	TaskStatusPending    = "pending"
	TaskStatusAccepted   = "accepted"
	TaskStatusInProgress = "in_progress"
	TaskStatusDone       = "done"
	TaskStatusCancelled  = "cancelled"
)

func ValidStatus(s string) bool {
	switch s {
	case TaskStatusPending, TaskStatusAccepted, TaskStatusInProgress, TaskStatusDone, TaskStatusCancelled:
		return true
	}
	return false
}

func ValidTaskType(s string) bool {
	switch s {
	case "survey", "inspect", "other":
		return true
	}
	return false
}

func TaskTypeLabel(t string) string {
	switch t {
	case "survey":
		return "งานเก็บข้อมูล"
	case "inspect":
		return "งานตรวจสอบ"
	default:
		return "งานอื่น ๆ"
	}
}

// User — id (internal) ไม่ expose ออกนอกระบบ ใช้ PublicID (UUID) เสมอ
type User struct {
	ID           int64     `json:"-"`
	PublicID     string    `json:"public_id"`
	LineUserID   string    `json:"-"`
	Username     *string   `json:"username,omitempty"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	PictureURL   *string   `json:"picture_url"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

// Task — เช่นเดียวกับ User ใช้ PublicID แทน id ตัวเลข
type Task struct {
	ID               int64      `json:"-"`
	PublicID         string     `json:"public_id"`
	Code             *string    `json:"code"`
	Title            string     `json:"title"`
	TaskType         string     `json:"task_type"`
	Description      string     `json:"description"`
	Status           string     `json:"status"`
	AssigneePublicID string     `json:"assignee_public_id"`
	AssigneeName     string     `json:"assignee_name"`
	AssignerPublicID string     `json:"assigner_public_id"`
	AssignerName     string     `json:"assigner_name"`
	DueAt            *time.Time `json:"due_at"`
	Lat              *float64   `json:"lat"`
	Lng              *float64   `json:"lng"`
	PlaceName        *string    `json:"place_name"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
