package service

import (
	"context"
	"errors"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
)

var (
	ErrForbidden      = errors.New("forbidden")
	ErrBadRequest     = errors.New("bad request")
	ErrLastSupervisor = errors.New("ต้องมีหัวหน้างานเหลืออย่างน้อย 1 คน")
	ErrSelfDemote     = errors.New("ไม่สามารถลดบทบาทตัวเองได้")
)

type UserService struct {
	users *repository.UserRepository
}

func NewUserService(users *repository.UserRepository) *UserService {
	return &UserService{users: users}
}

func (s *UserService) List(ctx context.Context, role *string) ([]model.User, error) {
	return s.users.List(ctx, role)
}

// ChangeRole — admin/supervisor เปลี่ยนบทบาทสมาชิก (target ระบุด้วย public_id เสมอ)
// - admin ตั้งได้ทุก role (รวม admin)
// - supervisor ตั้งได้เฉพาะ supervisor/subordinate
func (s *UserService) ChangeRole(ctx context.Context, actor *Claims, targetPublicID string, role model.Role) error {
	target, err := s.users.FindByPublicID(ctx, targetPublicID)
	if err != nil {
		return ErrBadRequest
	}
	valid := map[model.Role]bool{
		model.RoleAdmin:       actor.Role == string(model.RoleAdmin),
		model.RoleSupervisor:  true,
		model.RoleSubordinate: true,
	}
	if !valid[role] {
		return ErrBadRequest
	}
	if target.ID == actor.UserID && string(role) != actor.Role {
		return ErrSelfDemote
	}
	// กันหัวหน้าหมดระบบ (นับเฉพาะ supervisor — admin ไม่นับ)
	if role == model.RoleSubordinate && target.Role == string(model.RoleSupervisor) {
		n, err := s.users.CountSupervisors(ctx)
		if err != nil {
			return err
		}
		isSup, _ := s.users.IsSupervisor(ctx, target.ID)
		if isSup && n <= 1 {
			return ErrLastSupervisor
		}
	}
	return s.users.UpdateRole(ctx, target.ID, role)
}
