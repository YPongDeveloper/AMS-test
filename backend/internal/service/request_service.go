package service

import (
	"context"
	"errors"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
	"ams-backend/internal/ws"
)

type RequestService struct {
	requests *repository.RequestRepository
	tasks    *repository.TaskRepository
	hub      *ws.Hub
}

func NewRequestService(requests *repository.RequestRepository, tasks *repository.TaskRepository, hub *ws.Hub) *RequestService {
	return &RequestService{requests: requests, tasks: tasks, hub: hub}
}

type CreateRequestInput struct {
	TargetType string  `json:"target_type"` // land | building | general
	TargetCode *string `json:"target_code,omitempty"`
	Remark     string  `json:"remark"`
}

func (s *RequestService) Create(ctx context.Context, actor *Claims, in CreateRequestInput) (*model.RevisionRequest, error) {
	if actor.Role != string(model.RoleAccountant) && actor.Role != string(model.RoleAdmin) {
		return nil, ErrForbidden
	}
	if in.Remark == "" {
		return nil, errors.New("ต้องระบุหมายเหตุหรือข้อความคำร้อง")
	}
	if in.TargetType == "" {
		in.TargetType = "general"
	}

	req, err := s.requests.Create(ctx, actor.UserID, in.TargetType, in.TargetCode, in.Remark)
	if err != nil {
		return nil, err
	}

	// กระจายสัญญาณแจ้งเตือนคำร้องใหม่ถึงหัวหน้างาน
	s.hub.Broadcast(ws.WSMessage{
		Type: "request.new",
	})
	return req, nil
}

func (s *RequestService) List(ctx context.Context, actor *Claims, status *string) ([]model.RevisionRequest, error) {
	return s.requests.List(ctx, status)
}

func (s *RequestService) AssignTask(ctx context.Context, actor *Claims, requestPublicID, taskPublicID string) error {
	if actor.Role != string(model.RoleSupervisor) && actor.Role != string(model.RoleAdmin) {
		return ErrForbidden
	}
	task, err := s.tasks.FindByPublicID(ctx, taskPublicID)
	if err != nil {
		return ErrNotFound
	}
	return s.requests.AssignTask(ctx, requestPublicID, task.ID)
}
