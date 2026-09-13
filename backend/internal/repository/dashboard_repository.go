package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DashboardRepository — เนื้อหาหน้า dashboard (mock data) เก็บเป็น JSONB
type DashboardRepository struct {
	db *pgxpool.Pool
}

func NewDashboardRepository(db *pgxpool.Pool) *DashboardRepository {
	return &DashboardRepository{db: db}
}

func (r *DashboardRepository) Get(ctx context.Context, key string) (json.RawMessage, error) {
	var data json.RawMessage
	err := r.db.QueryRow(ctx,
		`SELECT data FROM dashboard_content WHERE key=$1`, key).Scan(&data)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (r *DashboardRepository) Save(ctx context.Context, key string, data json.RawMessage) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO dashboard_content (key, data, updated_at) VALUES ($1,$2,now())
		 ON CONFLICT (key) DO UPDATE SET data=$2, updated_at=now()`,
		key, data)
	return err
}
