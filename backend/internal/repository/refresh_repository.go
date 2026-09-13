package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RefreshTokenRepository — เก็บ hash ของ refresh token (ไม่เก็บ token ดิบ)
type RefreshTokenRepository struct {
	db *pgxpool.Pool
}

func NewRefreshTokenRepository(db *pgxpool.Pool) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
		userID, tokenHash, expiresAt)
	return err
}

// FindValid — คืน user_id ถ้า hash นี้ยังไม่ถูก revoke และยังไม่หมดอายุ
func (r *RefreshTokenRepository) FindValid(ctx context.Context, tokenHash string) (int64, error) {
	var userID int64
	err := r.db.QueryRow(ctx,
		`SELECT user_id FROM refresh_tokens
		 WHERE token_hash=$1 AND revoked=false AND expires_at > now()`,
		tokenHash).Scan(&userID)
	return userID, err
}

func (r *RefreshTokenRepository) Revoke(ctx context.Context, tokenHash string) error {
	_, err := r.db.Exec(ctx, `UPDATE refresh_tokens SET revoked=true WHERE token_hash=$1`, tokenHash)
	return err
}

// RevokeAllForUser — ใช้ตอนเปลี่ยนรหัส/ban ในอนาคต
func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userID int64) error {
	_, err := r.db.Exec(ctx, `UPDATE refresh_tokens SET revoked=true WHERE user_id=$1`, userID)
	return err
}
