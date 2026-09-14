package service

import (
	"context"
	"errors"
	"strings"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
)

type BuildingService struct {
	repo *repository.BuildingRepository
}

func NewBuildingService(repo *repository.BuildingRepository) *BuildingService {
	return &BuildingService{repo: repo}
}

func (s *BuildingService) List(ctx context.Context, q, landCode string) ([]model.Building, error) {
	return s.repo.List(ctx, strings.TrimSpace(q), strings.TrimSpace(landCode))
}

func (s *BuildingService) Get(ctx context.Context, publicID string) (*model.Building, error) {
	return s.repo.FindByPublicID(ctx, publicID)
}

func (s *BuildingService) Create(ctx context.Context, actor *Claims, b *model.Building) (*model.Building, error) {
	b.BldgCode = strings.TrimSpace(b.BldgCode)
	if b.BldgCode == "" {
		return nil, errors.New("ต้องระบุรหัสประจำสิ่งปลูกสร้าง (Bldg_Code)")
	}
	b.Name = strings.TrimSpace(b.Name)
	if b.Name == "" {
		return nil, errors.New("ต้องระบุชื่ออาคารสิ่งปลูกสร้าง (Name)")
	}
	// Auto calculate floor dim if width & length provided and dim is missing
	for i := range b.Floors {
		if b.Floors[i].Dim == nil && b.Floors[i].Width != nil && b.Floors[i].Length != nil {
			calc := (*b.Floors[i].Width) * (*b.Floors[i].Length)
			b.Floors[i].Dim = &calc
		}
	}

	var userID *int64
	if actor != nil && actor.UserID != 0 {
		uid := actor.UserID
		userID = &uid
	}
	return s.repo.Create(ctx, b, userID)
}

func (s *BuildingService) Update(ctx context.Context, publicID string, b *model.Building) (*model.Building, error) {
	b.BldgCode = strings.TrimSpace(b.BldgCode)
	if b.BldgCode == "" {
		return nil, errors.New("ต้องระบุรหัสประจำสิ่งปลูกสร้าง (Bldg_Code)")
	}
	b.Name = strings.TrimSpace(b.Name)
	if b.Name == "" {
		return nil, errors.New("ต้องระบุชื่ออาคารสิ่งปลูกสร้าง (Name)")
	}
	for i := range b.Floors {
		if b.Floors[i].Dim == nil && b.Floors[i].Width != nil && b.Floors[i].Length != nil {
			calc := (*b.Floors[i].Width) * (*b.Floors[i].Length)
			b.Floors[i].Dim = &calc
		}
	}
	return s.repo.Update(ctx, publicID, b)
}

func (s *BuildingService) Delete(ctx context.Context, publicID string) error {
	return s.repo.Delete(ctx, publicID)
}
