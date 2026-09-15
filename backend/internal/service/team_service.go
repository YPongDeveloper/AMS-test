package service

import (
	"context"
	"errors"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
	"ams-backend/internal/ws"
)

type TeamService struct {
	team  *repository.TeamRepository
	users *repository.UserRepository
	hub   *ws.Hub
}

func NewTeamService(team *repository.TeamRepository, users *repository.UserRepository, hub *ws.Hub) *TeamService {
	return &TeamService{team: team, users: users, hub: hub}
}

func (s *TeamService) InviteByUsername(ctx context.Context, supervisorClaims *Claims, username string) error {
	if supervisorClaims.Role != string(model.RoleSupervisor) && supervisorClaims.Role != string(model.RoleAdmin) {
		return ErrForbidden
	}
	subordinate, err := s.users.FindByUsername(ctx, username)
	if err != nil {
		return errors.New("ไม่พบพนักงานที่มีชื่อผู้ใช้นี้")
	}
	if subordinate.Status == model.UserStatusResigned {
		return errors.New("พนักงานนี้พ้นสภาพการเป็นพนักงานแล้ว")
	}
	if subordinate.Role != string(model.RoleSubordinate) {
		return errors.New("สามารถเชิญได้เฉพาะผู้ใช้ที่มีบทบาทพนักงานสำรวจเท่านั้น")
	}

	if err := s.team.Invite(ctx, supervisorClaims.UserID, subordinate.ID); err != nil {
		return err
	}

	// ส่ง WebSocket แจ้งเตือนไปยังลูกน้อง
	s.hub.SendToUser(subordinate.ID, ws.WSMessage{
		Type: "team.invitation",
	})
	return nil
}

func (s *TeamService) ListMyTeam(ctx context.Context, supervisorClaims *Claims) ([]model.TeamMember, error) {
	if supervisorClaims.Role != string(model.RoleSupervisor) && supervisorClaims.Role != string(model.RoleAdmin) {
		return nil, ErrForbidden
	}
	return s.team.ListBySupervisor(ctx, supervisorClaims.UserID)
}

func (s *TeamService) ListMyInvitations(ctx context.Context, subordinateClaims *Claims) ([]model.TeamMember, error) {
	return s.team.ListInvitationsForSubordinate(ctx, subordinateClaims.UserID)
}

func (s *TeamService) Respond(ctx context.Context, subordinateClaims *Claims, supervisorPublicID string, action string) error {
	if action != "accepted" && action != "declined" {
		return errors.New("action ต้องเป็น accepted หรือ declined")
	}
	supervisor, err := s.users.FindByPublicID(ctx, supervisorPublicID)
	if err != nil {
		return errors.New("ไม่พบหัวหน้างาน")
	}

	if err := s.team.Respond(ctx, supervisor.ID, subordinateClaims.UserID, action); err != nil {
		return err
	}

	// แจ้งเตือนหัวหน้างาน
	s.hub.SendToUser(supervisor.ID, ws.WSMessage{
		Type: "team.response",
	})
	return nil
}

func (s *TeamService) RemoveMember(ctx context.Context, supervisorClaims *Claims, subordinatePublicID string) error {
	if supervisorClaims.Role != string(model.RoleSupervisor) && supervisorClaims.Role != string(model.RoleAdmin) {
		return ErrForbidden
	}
	subordinate, err := s.users.FindByPublicID(ctx, subordinatePublicID)
	if err != nil {
		return errors.New("ไม่พบพนักงาน")
	}
	return s.team.RemoveMember(ctx, supervisorClaims.UserID, subordinate.ID)
}
