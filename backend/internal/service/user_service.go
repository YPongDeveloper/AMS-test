package service

import (
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
)

var (
	ErrForbidden      = errors.New("ไม่มีสิทธิ์เข้าถึงส่วนนี้")
	ErrBadRequest     = errors.New("ข้อมูลไม่ถูกต้อง")
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
func (s *UserService) ChangeRole(ctx context.Context, actor *Claims, targetPublicID string, role model.Role) error {
	target, err := s.users.FindByPublicID(ctx, targetPublicID)
	if err != nil {
		return ErrBadRequest
	}
	valid := map[model.Role]bool{
		model.RoleAdmin:       actor.Role == string(model.RoleAdmin),
		model.RoleSupervisor:  actor.Role == string(model.RoleAdmin),
		model.RoleSubordinate: true,
		model.RoleAccountant:  actor.Role == string(model.RoleAdmin),
	}
	if !valid[role] {
		return ErrBadRequest
	}
	if target.ID == actor.UserID && string(role) != actor.Role {
		return ErrSelfDemote
	}
	// กันหัวหน้าหมดระบบ
	if role != model.RoleSupervisor && target.Role == string(model.RoleSupervisor) {
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

// CreateUser — แอดมินสร้างผู้ใช้ใหม่ (กำหนด username, password, display_name, role)
func (s *UserService) CreateUser(ctx context.Context, actor *Claims, username, password, displayName string, role model.Role) (*model.User, error) {
	if actor == nil || actor.Role != string(model.RoleAdmin) {
		return nil, ErrForbidden
	}
	username = strings.TrimSpace(username)
	displayName = strings.TrimSpace(displayName)
	if username == "" || len(username) < 3 {
		return nil, errors.New("ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร")
	}
	if len(password) < 6 {
		return nil, errors.New("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร")
	}
	if displayName == "" {
		displayName = username
	}
	if !model.ValidRole(string(role)) {
		return nil, errors.New("บทบาทไม่ถูกต้อง")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	return s.users.CreateWithPassword(ctx, username, string(hash), displayName, role)
}

// UpdateUser — แอดมินแก้ไขข้อมูลผู้ใช้ (ชื่อที่แสดง, บทบาท, สถานะ)
func (s *UserService) UpdateUser(ctx context.Context, actor *Claims, targetPublicID string, displayName string, role model.Role, status string) error {
	if actor == nil || actor.Role != string(model.RoleAdmin) {
		return ErrForbidden
	}
	target, err := s.users.FindByPublicID(ctx, targetPublicID)
	if err != nil {
		return ErrBadRequest
	}
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return errors.New("ชื่อที่แสดงต้องไม่ว่างเปล่า")
	}
	if !model.ValidRole(string(role)) {
		return errors.New("บทบาทไม่ถูกต้อง")
	}
	if !model.ValidUserStatus(status) {
		return errors.New("สถานะต้องเป็น active หรือ resigned")
	}
	// ห้ามปลดตัวเองออกถ้าเป็น admin ที่กำลังทำรายการ
	if target.ID == actor.UserID && status == model.UserStatusResigned {
		return errors.New("ไม่สามารถเปลี่ยนสถานะตัวเองเป็นพ้นสภาพได้")
	}

	return s.users.UpdateUser(ctx, target.ID, displayName, role, status)
}

// ResetPassword — แอดมินรีเซ็ตหรือตั้งรหัสผ่านใหม่ให้ผู้ใช้
func (s *UserService) ResetPassword(ctx context.Context, actor *Claims, targetPublicID string, newPassword string) error {
	if actor == nil || actor.Role != string(model.RoleAdmin) {
		return ErrForbidden
	}
	if len(newPassword) < 6 {
		return errors.New("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร")
	}
	target, err := s.users.FindByPublicID(ctx, targetPublicID)
	if err != nil {
		return ErrBadRequest
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(ctx, target.ID, string(hash))
}

// SetStatus — แอดมินปรับสถานะพนักงาน (เช่น เลิกจ้าง/พ้นสภาพ Soft Delete)
func (s *UserService) SetStatus(ctx context.Context, actor *Claims, targetPublicID string, status string) error {
	if actor == nil || actor.Role != string(model.RoleAdmin) {
		return ErrForbidden
	}
	if !model.ValidUserStatus(status) {
		return errors.New("สถานะต้องเป็น active หรือ resigned")
	}
	target, err := s.users.FindByPublicID(ctx, targetPublicID)
	if err != nil {
		return ErrBadRequest
	}
	if target.ID == actor.UserID && status == model.UserStatusResigned {
		return errors.New("ไม่สามารถเปลี่ยนสถานะตัวเองเป็นพ้นสภาพได้")
	}
	return s.users.UpdateStatus(ctx, target.ID, status)
}
