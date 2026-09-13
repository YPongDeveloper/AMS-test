package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/model"
)

var ErrNotFound = pgx.ErrNoRows

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// COALESCE line_user_id — บัญชี username/password ไม่มี LINE (NULL) ต้อง scan เป็น string ได้
const userCols = `id, public_id, COALESCE(line_user_id,'') AS line_user_id, username, password_hash, display_name, picture_url, role, created_at`

func scanUser(row pgx.Row) (*model.User, error) {
	var u model.User
	err := row.Scan(&u.ID, &u.PublicID, &u.LineUserID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.PictureURL, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) CountAll(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}

func (r *UserRepository) FindByLineUserID(ctx context.Context, lineUserID string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`SELECT `+userCols+` FROM users WHERE line_user_id=$1`, lineUserID))
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`SELECT `+userCols+` FROM users WHERE username=$1`, username))
}

func (r *UserRepository) CreateWithPassword(ctx context.Context, username, passwordHash, displayName string, role model.Role) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`INSERT INTO users (username, password_hash, display_name, role)
		 VALUES ($1,$2,$3,$4) RETURNING `+userCols,
		username, passwordHash, displayName, string(role)))
}

func (r *UserRepository) Create(ctx context.Context, lineUserID, displayName string, pictureURL *string, role model.Role) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`INSERT INTO users (line_user_id, display_name, picture_url, role)
		 VALUES ($1,$2,$3,$4) RETURNING `+userCols,
		lineUserID, displayName, pictureURL, string(role)))
}

func (r *UserRepository) UpdateProfile(ctx context.Context, id int64, displayName string, pictureURL *string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET display_name=$1, picture_url=$2 WHERE id=$3`,
		displayName, pictureURL, id)
	return err
}

func (r *UserRepository) FindByPublicID(ctx context.Context, publicID string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`SELECT `+userCols+` FROM users WHERE public_id=$1`, publicID))
}

func (r *UserRepository) FindByID(ctx context.Context, id int64) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`SELECT `+userCols+` FROM users WHERE id=$1`, id))
}

func (r *UserRepository) List(ctx context.Context, role *string) ([]model.User, error) {
	q := `SELECT ` + userCols + ` FROM users`
	args := []any{}
	if role != nil && (*role == string(model.RoleSupervisor) || *role == string(model.RoleSubordinate)) {
		q += ` WHERE role=$1`
		args = append(args, *role)
	}
	q += ` ORDER BY created_at ASC LIMIT 500`
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.User{}
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.PublicID, &u.LineUserID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.PictureURL, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *UserRepository) UpdateRole(ctx context.Context, id int64, role model.Role) error {
	tag, err := r.db.Exec(ctx, `UPDATE users SET role=$1 WHERE id=$2`, string(role), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *UserRepository) CountSupervisors(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM users WHERE role=$1`, string(model.RoleSupervisor)).Scan(&n)
	return n, err
}

func (r *UserRepository) IsSupervisor(ctx context.Context, id int64) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `SELECT role='supervisor' FROM users WHERE id=$1`, id).Scan(&ok)
	return ok, err
}

func (r *UserRepository) GetLineUserID(ctx context.Context, id int64) (string, error) {
	var s string
	err := r.db.QueryRow(ctx, `SELECT line_user_id FROM users WHERE id=$1`, id).Scan(&s)
	return s, err
}

// Errors helper
func IsNotFound(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
