package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openDB() (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required (ใช้ connection string จาก Supabase/Postgres)")
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	// Supabase free tier: direct connection เป็น IPv6-only ต้องใช้ Transaction pooler (port 6543)
	// ซึ่งเป็น PgBouncer transaction mode — ต้องปิด prepared statements
	if strings.Contains(cfg.ConnConfig.Host, "pooler.supabase.com") {
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
		log.Println("DB: Supabase pooler detected → simple protocol")
	}
	cfg.MaxConns = 5
	cfg.MaxConnLifetime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
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
	line_user_id  TEXT UNIQUE NOT NULL,
	display_name  TEXT NOT NULL,
	picture_url   TEXT,
	role          TEXT NOT NULL DEFAULT 'subordinate' CHECK (role IN ('supervisor','subordinate')),
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
	id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, schema)
	return err
}
