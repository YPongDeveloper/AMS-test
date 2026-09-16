package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
	"ams-backend/internal/ws"
)

var ErrNotFound = errors.New("ไม่พบรายการ")

type TaskService struct {
	tasks *repository.TaskRepository
	users *repository.UserRepository
	lands *repository.LandRepository
	bldgs *repository.BuildingRepository
	hub   *ws.Hub
}

func NewTaskService(tasks *repository.TaskRepository, users *repository.UserRepository, lands *repository.LandRepository, bldgs *repository.BuildingRepository, hub *ws.Hub) *TaskService {
	return &TaskService{tasks: tasks, users: users, lands: lands, bldgs: bldgs, hub: hub}
}

type CreateTaskInput struct {
	Title            string     `json:"title"`
	TaskType         string     `json:"task_type"`
	Description      string     `json:"description"`
	AssigneePublicID string     `json:"assignee_public_id"`
	DueAt            *time.Time `json:"due_at"`
	Lat              *float64   `json:"lat"`
	Lng              *float64   `json:"lng"`
	PlaceName        *string    `json:"place_name"`
	TargetType       *string    `json:"target_type"`
}

func (s *TaskService) ListFor(ctx context.Context, c *Claims, status *string) ([]model.Task, error) {
	if c.Role == string(model.RoleAdmin) {
		return s.tasks.ListAll(ctx, status)
	}
	if c.Role == string(model.RoleSupervisor) {
		return s.tasks.ListForSupervisor(ctx, c.UserID, status)
	}
	return s.tasks.ListMine(ctx, c.UserID, status)
}

// Create — หัวหน้าสั่งงาน → บันทึก → WS realtime
func (s *TaskService) Create(ctx context.Context, actor *Claims, in CreateTaskInput) (*model.Task, error) {
	if in.Title == "" {
		return nil, errors.New("ต้องระบุชื่องาน")
	}
	if !model.ValidTaskType(in.TaskType) {
		in.TaskType = model.TaskTypeSurveyNew
	}
	assignee, err := s.users.FindByPublicID(ctx, in.AssigneePublicID)
	if err != nil {
		return nil, errors.New("ไม่พบบัญชีผู้รับงาน")
	}

	task, err := s.tasks.Create(ctx, in.Title, in.TaskType, in.Description,
		assignee.ID, actor.UserID, in.DueAt, in.Lat, in.Lng, in.PlaceName, in.TargetType)
	if err != nil {
		return nil, err
	}

	// realtime หาผู้รับงาน
	s.hub.SendToUser(assignee.ID, ws.WSMessage{Type: "task.new", Task: task})
	return task, nil
}

// UpdateStatus — ผู้รับงาน/หัวหน้าเปลี่ยนสถานะ (ระบุงานด้วย public_id)
func (s *TaskService) UpdateStatus(ctx context.Context, actor *Claims, publicID, status string) (*model.Task, error) {
	if !model.ValidStatus(status) {
		return nil, errors.New("status ไม่ถูกต้อง")
	}
	task, err := s.tasks.FindByPublicID(ctx, publicID)
	if err != nil {
		return nil, ErrNotFound
	}
	assigneeID, assignerID, err := s.tasks.AssigneeAndAssigner(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	isAssignee := actor.UserID == assigneeID
	isAssigner := actor.UserID == assignerID
	isAdmin := actor.Role == string(model.RoleAdmin)
	isSupervisor := actor.Role == string(model.RoleSupervisor)

	// สิทธิ์ทั่วไปในการเปลี่ยนสถานะ
	if !isAssignee && !isAssigner && !isSupervisor && !isAdmin {
		return nil, ErrForbidden
	}

	// เงื่อนไขพิเศษสำหรับการยกเลิกงาน: ต้องเป็นผู้รับมอบหมาย หรือผู้สั่งงาน/หัวหน้า หรือ Admin เท่านั้น
	if status == "cancelled" && !isAssignee && !isAssigner && !isSupervisor && !isAdmin {
		return nil, errors.New("เฉพาะผู้ได้รับมอบหมายงานหรือหัวหน้างานในสังกัดเท่านั้นที่มีสิทธิ์ยกเลิกงานนี้")
	}

	if err := s.tasks.UpdateStatus(ctx, task.ID, status); err != nil {
		return nil, err
	}
	updated, err := s.tasks.FindByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	s.hub.SendToUser(assigneeID, ws.WSMessage{Type: "task.update", Task: updated})
	s.hub.SendToUser(assignerID, ws.WSMessage{Type: "task.update", Task: updated})
	return updated, nil
}

// SubmitData — ลูกน้องกรอกข้อมูลสำรวจ/ลงข้อมูลเสร็จ ส่งให้หัวหน้าตรวจสอบ
func (s *TaskService) SubmitData(ctx context.Context, actor *Claims, publicID string, submissionJSON string) (*model.Task, error) {
	task, err := s.tasks.FindByPublicID(ctx, publicID)
	if err != nil {
		return nil, ErrNotFound
	}
	assigneeID, assignerID, err := s.tasks.AssigneeAndAssigner(ctx, task.ID)
	if err != nil {
		return nil, err
	}
	if actor.UserID != assigneeID && actor.Role != string(model.RoleAdmin) {
		return nil, ErrForbidden
	}

	if err := s.tasks.SubmitData(ctx, task.ID, submissionJSON); err != nil {
		return nil, err
	}
	updated, err := s.tasks.FindByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	s.hub.SendToUser(assignerID, ws.WSMessage{Type: "task.submitted", Task: updated})
	return updated, nil
}

type ReviewInput struct {
	Action   string  `json:"action"` // approve | reject
	Feedback *string `json:"feedback,omitempty"`
}

type SubmittedPayload struct {
	Lands     []model.LandParcel `json:"lands"`
	Buildings []model.Building   `json:"buildings"`
}

// Review — หัวหน้างานตรวจสอบงาน (อนุมัติเพื่อ commit ข้อมูลจริง หรือ ส่งกลับให้แก้ไข)
func (s *TaskService) Review(ctx context.Context, actor *Claims, publicID string, in ReviewInput) (*model.Task, error) {
	if actor.Role != string(model.RoleSupervisor) && actor.Role != string(model.RoleAdmin) {
		return nil, ErrForbidden
	}
	task, err := s.tasks.FindByPublicID(ctx, publicID)
	if err != nil {
		return nil, ErrNotFound
	}
	assigneeID, _, err := s.tasks.AssigneeAndAssigner(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	var newStatus string
	if in.Action == "approve" {
		newStatus = model.TaskStatusDone

		// Commit ข้อมูลที่ลูกน้องกรอกลงในตาราง land_parcels และ buildings จริง
		if task.SubmissionData != nil && *task.SubmissionData != "" {
			var payload SubmittedPayload
			if err := json.Unmarshal([]byte(*task.SubmissionData), &payload); err == nil {
				for _, l := range payload.Lands {
					if l.LandCode != "" {
						_, _ = s.lands.Create(ctx, &l, &assigneeID)
					}
				}
				for _, b := range payload.Buildings {
					if b.BldgCode != "" {
						_, _ = s.bldgs.Create(ctx, &b, &assigneeID)
					}
				}
			}
		}
	} else if in.Action == "reject" {
		newStatus = model.TaskStatusRevisionRequested
	} else {
		return nil, errors.New("action ต้องเป็น approve หรือ reject")
	}

	if err := s.tasks.ReviewTask(ctx, task.ID, newStatus, in.Feedback); err != nil {
		return nil, err
	}
	updated, err := s.tasks.FindByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	s.hub.SendToUser(assigneeID, ws.WSMessage{Type: "task.reviewed", Task: updated})
	return updated, nil
}
