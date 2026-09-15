package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/model"
)

type RequestRepository struct {
	db *pgxpool.Pool
}

func NewRequestRepository(db *pgxpool.Pool) *RequestRepository {
	return &RequestRepository{db: db}
}

const reqCols = `
r.id, r.public_id, r.requested_by, u.public_id, u.display_name,
r.target_type, r.target_code, r.remark, r.status,
r.assigned_task_id, t.public_id,
r.created_at, r.updated_at
`

const reqFrom = `
FROM revision_requests r
JOIN users u ON u.id = r.requested_by
LEFT JOIN tasks t ON t.id = r.assigned_task_id
`

func scanRequest(row interface{ Scan(...any) error }) (*model.RevisionRequest, error) {
	var req model.RevisionRequest
	var taskPID *string
	err := row.Scan(
		&req.ID, &req.PublicID, &req.RequestedBy, &req.RequesterPublicID, &req.RequesterName,
		&req.TargetType, &req.TargetCode, &req.Remark, &req.Status,
		&req.AssignedTaskID, &taskPID,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	req.AssignedTaskPublic = taskPID
	return &req, nil
}

func (r *RequestRepository) Create(ctx context.Context, requestedBy int64, targetType string, targetCode *string, remark string) (*model.RevisionRequest, error) {
	var id int64
	err := r.db.QueryRow(ctx, `
		INSERT INTO revision_requests (requested_by, target_type, target_code, remark, status)
		VALUES ($1, $2, $3, $4, 'pending')
		RETURNING id
	`, requestedBy, targetType, targetCode, remark).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *RequestRepository) FindByID(ctx context.Context, id int64) (*model.RevisionRequest, error) {
	return scanRequest(r.db.QueryRow(ctx, `SELECT `+reqCols+reqFrom+` WHERE r.id=$1`, id))
}

func (r *RequestRepository) FindByPublicID(ctx context.Context, publicID string) (*model.RevisionRequest, error) {
	return scanRequest(r.db.QueryRow(ctx, `SELECT `+reqCols+reqFrom+` WHERE r.public_id=$1`, publicID))
}

func (r *RequestRepository) List(ctx context.Context, status *string) ([]model.RevisionRequest, error) {
	q := `SELECT ` + reqCols + reqFrom
	var args []any
	if status != nil && *status != "" {
		q += ` WHERE r.status = $1`
		args = append(args, *status)
	}
	q += ` ORDER BY r.created_at DESC LIMIT 100`

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.RevisionRequest, 0)
	for rows.Next() {
		req, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *req)
	}
	return list, nil
}

func (r *RequestRepository) AssignTask(ctx context.Context, requestPublicID string, taskID int64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE revision_requests
		SET assigned_task_id = $1, status = 'assigned', updated_at = now()
		WHERE public_id = $2
	`, taskID, requestPublicID)
	return err
}

func (r *RequestRepository) Resolve(ctx context.Context, requestPublicID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE revision_requests
		SET status = 'resolved', updated_at = now()
		WHERE public_id = $1
	`, requestPublicID)
	return err
}
