package repository

import (
	"context"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/model"
)

type TaskRepository struct {
	db *pgxpool.Pool
}

func NewTaskRepository(db *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{db: db}
}

const taskCols = `
t.id, t.public_id, t.code, t.title, t.task_type, t.description, t.status,
t.assigned_to, ua.public_id, ua.display_name,
t.assigned_by, ub.public_id, ub.display_name,
t.due_at, t.lat, t.lng, t.place_name,
t.submission_data::text, t.supervisor_feedback, t.target_type,
t.created_at, t.updated_at`

const taskFrom = `
FROM tasks t
JOIN users ua ON ua.id = t.assigned_to
JOIN users ub ON ub.id = t.assigned_by
`

func scanTask(row interface{ Scan(...any) error }) (*model.Task, error) {
	var t model.Task
	var assigneeID, assignerID int64
	err := row.Scan(&t.ID, &t.PublicID, &t.Code, &t.Title, &t.TaskType, &t.Description, &t.Status,
		&assigneeID, &t.AssigneePublicID, &t.AssigneeName,
		&assignerID, &t.AssignerPublicID, &t.AssignerName,
		&t.DueAt, &t.Lat, &t.Lng, &t.PlaceName,
		&t.SubmissionData, &t.SupervisorFeedback, &t.TargetType,
		&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func statusClause(status *string, args *[]any) string {
	if status == nil || !model.ValidStatus(*status) {
		return ""
	}
	*args = append(*args, *status)
	return ` AND t.status=$` + strconv.Itoa(len(*args))
}

func collectTasks(rows interface {
	Next() bool
	Scan(...any) error
}) ([]model.Task, error) {
	out := []model.Task{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, nil
}

// ListMine — งานของผู้ใช้คนหนึ่ง (ลูกน้อง)
func (r *TaskRepository) ListMine(ctx context.Context, userID int64, status *string) ([]model.Task, error) {
	q := `SELECT ` + taskCols + taskFrom + ` WHERE t.assigned_to=$1`
	args := []any{userID}
	q += statusClause(status, &args)
	q += ` ORDER BY t.created_at DESC LIMIT 200`
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectTasks(rows)
}

// ListAll — หัวหน้าเห็นทุกงาน
func (r *TaskRepository) ListAll(ctx context.Context, status *string) ([]model.Task, error) {
	q := `SELECT ` + taskCols + taskFrom + ` WHERE true`
	args := []any{}
	q += statusClause(status, &args)
	q += ` ORDER BY t.created_at DESC LIMIT 200`
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectTasks(rows)
}

// FindByPublicID — ค้นด้วย public UUID
func (r *TaskRepository) FindByPublicID(ctx context.Context, publicID string) (*model.Task, error) {
	return scanTask(r.db.QueryRow(ctx, `SELECT `+taskCols+taskFrom+` WHERE t.public_id=$1`, publicID))
}

// Create — insert แล้วโหลดกลับมาเต็มรูป (รวมชื่อ/uuid ของสองฝั่ง)
func (r *TaskRepository) Create(ctx context.Context, title, taskType, description string,
	assigneeID, assignerID int64, dueAt *time.Time, lat, lng *float64, placeName *string, targetType *string) (*model.Task, error) {
	var id int64
	err := r.db.QueryRow(ctx, `
		INSERT INTO tasks (title, task_type, description, assigned_to, assigned_by, due_at, lat, lng, place_name, target_type)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		title, taskType, description, assigneeID, assignerID, dueAt, lat, lng, placeName, targetType).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *TaskRepository) FindByID(ctx context.Context, id int64) (*model.Task, error) {
	return scanTask(r.db.QueryRow(ctx, `SELECT `+taskCols+taskFrom+` WHERE t.id=$1`, id))
}

func (r *TaskRepository) UpdateStatus(ctx context.Context, id int64, status string) error {
	_, err := r.db.Exec(ctx, `UPDATE tasks SET status=$1, updated_at=now() WHERE id=$2`, status, id)
	return err
}

func (r *TaskRepository) SubmitData(ctx context.Context, id int64, submissionJSON string) error {
	_, err := r.db.Exec(ctx, `UPDATE tasks SET submission_data=$1::jsonb, status='submitted', updated_at=now() WHERE id=$2`, submissionJSON, id)
	return err
}

func (r *TaskRepository) ReviewTask(ctx context.Context, id int64, status string, feedback *string) error {
	_, err := r.db.Exec(ctx, `UPDATE tasks SET status=$1, supervisor_feedback=$2, updated_at=now() WHERE id=$3`, status, feedback, id)
	return err
}

// AssigneeAndAssigner — internal ids (ใช้เช็คสิทธิ์/เชื่อม WS เท่านั้น)
func (r *TaskRepository) AssigneeAndAssigner(ctx context.Context, id int64) (assignee, assigner int64, err error) {
	err = r.db.QueryRow(ctx, `SELECT assigned_to, assigned_by FROM tasks WHERE id=$1`, id).Scan(&assignee, &assigner)
	return
}
