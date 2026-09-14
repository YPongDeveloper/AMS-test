package service

import (
	"context"
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
	hub   *ws.Hub
}

func NewTaskService(tasks *repository.TaskRepository, users *repository.UserRepository, hub *ws.Hub) *TaskService {
	return &TaskService{tasks: tasks, users: users, hub: hub}
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
}

func (s *TaskService) ListFor(ctx context.Context, c *Claims, status *string) ([]model.Task, error) {
	if c.Role == string(model.RoleSupervisor) {
		return s.tasks.ListAll(ctx, status)
	}
	return s.tasks.ListMine(ctx, c.UserID, status)
}

// Create — หัวหน้าสั่งงาน → บันทึก → WS realtime → LINE Flex push
func (s *TaskService) Create(ctx context.Context, actor *Claims, in CreateTaskInput) (*model.Task, error) {
	if in.Title == "" {
		return nil, errors.New("ต้องระบุชื่องาน")
	}
	if !model.ValidTaskType(in.TaskType) {
		in.TaskType = "survey"
	}
	assignee, err := s.users.FindByPublicID(ctx, in.AssigneePublicID)
	if err != nil {
		return nil, errors.New("ไม่พบบัญชีผู้รับงาน")
	}

	task, err := s.tasks.Create(ctx, in.Title, in.TaskType, in.Description,
		assignee.ID, actor.UserID, in.DueAt, in.Lat, in.Lng, in.PlaceName)
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
	if actor.UserID != assigneeID && actor.UserID != assignerID && actor.Role != string(model.RoleSupervisor) {
		return nil, ErrForbidden
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
