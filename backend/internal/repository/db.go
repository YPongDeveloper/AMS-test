package repository

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Open(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	// Supabase free tier: direct connection เป็น IPv6-only → ใช้ Transaction pooler (6543)
	// ซึ่งเป็น PgBouncer transaction mode → ต้องปิด prepared statements
	if strings.Contains(cfg.ConnConfig.Host, "pooler.supabase.com") {
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
		log.Println("DB: Supabase pooler detected → simple protocol")
	}
	cfg.MaxConns = 5
	cfg.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}
	return pool, nil
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	public_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
	line_user_id  TEXT UNIQUE,
	username      TEXT UNIQUE,
	password_hash TEXT,
	display_name  TEXT NOT NULL,
	picture_url   TEXT,
	role          TEXT NOT NULL DEFAULT 'subordinate' CHECK (role IN ('admin','supervisor','subordinate')),
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อัปเกรดฐานที่สร้างไว้ก่อนหน้า (constraint เดิมไม่มี admin / ไม่มีคอลัมน์ username)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','supervisor','subordinate'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ALTER COLUMN line_user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_line ON users(line_user_id) WHERE line_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tasks (
	id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	public_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
	code         TEXT GENERATED ALWAYS AS ('TSK-' || lpad(id::text, 6, '0')) STORED,
	title        TEXT NOT NULL,
	task_type    TEXT NOT NULL DEFAULT 'survey',
	description  TEXT NOT NULL DEFAULT '',
	status       TEXT NOT NULL DEFAULT 'pending'
	             CHECK (status IN ('pending','accepted','in_progress','done','cancelled')),
	assigned_to  BIGINT NOT NULL REFERENCES users(id),
	assigned_by  BIGINT NOT NULL REFERENCES users(id),
	due_at       TIMESTAMPTZ,
	lat          DOUBLE PRECISION,
	lng          DOUBLE PRECISION,
	place_name   TEXT,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
	id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash TEXT UNIQUE NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	revoked    BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เนื้อหาหน้า dashboard (mock data รองรับหน้าบ้าน)
CREATE TABLE IF NOT EXISTS dashboard_content (
	key        TEXT PRIMARY KEY,
	data       JSONB NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
`

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, schema)
	return err
}
