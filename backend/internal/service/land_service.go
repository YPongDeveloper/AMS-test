package service

import (
	"context"
	"errors"
	"strings"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
)

type LandService struct {
	repo *repository.LandRepository
}

func NewLandService(repo *repository.LandRepository) *LandService {
	return &LandService{repo: repo}
}

func (s *LandService) List(ctx context.Context, q string) ([]model.LandParcel, error) {
	return s.repo.List(ctx, strings.TrimSpace(q))
}

func (s *LandService) Get(ctx context.Context, publicID string) (*model.LandParcel, error) {
	return s.repo.FindByPublicID(ctx, publicID)
}

func (s *LandService) Create(ctx context.Context, actor *Claims, l *model.LandParcel) (*model.LandParcel, error) {
	l.LandCode = strings.TrimSpace(l.LandCode)
	if l.LandCode == "" {
		return nil, errors.New("ต้องระบุรหัสประจำที่ดิน (Land_Code)")
	}
	var userID *int64
	if actor != nil && actor.UserID != 0 {
		uid := actor.UserID
		userID = &uid
	}
	return s.repo.Create(ctx, l, userID)
}

func (s *LandService) Update(ctx context.Context, publicID string, l *model.LandParcel) (*model.LandParcel, error) {
	l.LandCode = strings.TrimSpace(l.LandCode)
	if l.LandCode == "" {
		return nil, errors.New("ต้องระบุรหัสประจำที่ดิน (Land_Code)")
	}
	return s.repo.Update(ctx, publicID, l)
}

func (s *LandService) Delete(ctx context.Context, publicID string) error {
	return s.repo.Delete(ctx, publicID)
}
