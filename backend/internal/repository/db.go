package repository

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PoolStats struct {
	TotalConns    int32 `json:"total_conns"`
	IdleConns     int32 `json:"idle_conns"`
	AcquiredConns int32 `json:"acquired_conns"`
	MaxConns      int32 `json:"max_conns"`
}

func GetPoolStats(pool *pgxpool.Pool) PoolStats {
	if pool == nil {
		return PoolStats{}
	}
	s := pool.Stat()
	return PoolStats{
		TotalConns:    s.TotalConns(),
		IdleConns:     s.IdleConns(),
		AcquiredConns: s.AcquiredConns(),
		MaxConns:      s.MaxConns(),
	}
}

func Open(ctx context.Context, dsn string, maxConns, minConns int32) (*pgxpool.Pool, error) {
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

	if maxConns <= 0 {
		maxConns = 10
	}
	if minConns < 0 {
		minConns = 2
	}
	if minConns > maxConns {
		minConns = maxConns
	}

	// Server Pool (Connection Pool) Settings เพื่อความเสถียร ไม่ให้ฐานข้อมูลล่ม
	cfg.MaxConns = maxConns
	cfg.MinConns = minConns
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute
	cfg.ConnConfig.ConnectTimeout = 5 * time.Second

	log.Printf("DB Server Pool configured: MaxConns=%d, MinConns=%d, IdleTimeout=5m, HealthCheck=1m", maxConns, minConns)

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
	role          TEXT NOT NULL DEFAULT 'subordinate' CHECK (role IN ('admin','supervisor','subordinate','accountant')),
	status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resigned')),
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อัปเกรดฐานที่สร้างไว้ก่อนหน้า
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','supervisor','subordinate','accountant'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active','resigned'));
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

CREATE TABLE IF NOT EXISTS land_parcels (
	id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	public_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
	land_code     VARCHAR(50) NOT NULL UNIQUE,
	srt_land_type VARCHAR(100) NOT NULL DEFAULT '',
	land_use      VARCHAR(100) NOT NULL DEFAULT '',
	land_type     VARCHAR(100) NOT NULL DEFAULT '',
	deed_no       VARCHAR(50) NOT NULL DEFAULT '',
	dimension     VARCHAR(50) NOT NULL DEFAULT '',
	rai           INTEGER NOT NULL DEFAULT 0,
	ngan          INTEGER NOT NULL DEFAULT 0,
	wa            NUMERIC(10,2) NOT NULL DEFAULT 0,
	width         NUMERIC(10,2),
	length        NUMERIC(10,2),
	picture_f     TEXT NOT NULL DEFAULT '',
	lat           DOUBLE PRECISION,
	lng           DOUBLE PRECISION,
	address_no    VARCHAR(200) NOT NULL DEFAULT '',
	subdistrict   VARCHAR(100) NOT NULL DEFAULT '',
	district      VARCHAR(100) NOT NULL DEFAULT '',
	province      VARCHAR(100) NOT NULL DEFAULT '',
	postal_code   VARCHAR(20) NOT NULL DEFAULT '',
	created_by    BIGINT REFERENCES users(id),
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อัปเกรดตารางสำหรับระบบที่มีตาราง land_parcels อยู่แล้ว
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS rai INTEGER NOT NULL DEFAULT 0;
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS ngan INTEGER NOT NULL DEFAULT 0;
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS wa NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS address_no VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS subdistrict VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS district VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS province VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS buildings (
	id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	public_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
	bldg_code          VARCHAR(50) NOT NULL UNIQUE,
	land_code          VARCHAR(50) NOT NULL DEFAULT '',
	name               VARCHAR(254) NOT NULL DEFAULT '',
	bldg_69            VARCHAR(254) NOT NULL DEFAULT '',
	material_type      VARCHAR(100) NOT NULL DEFAULT '',
	age                VARCHAR(20) NOT NULL DEFAULT '',
	be_age             VARCHAR(20) NOT NULL DEFAULT '',
	num_fl             NUMERIC(5,2) NOT NULL DEFAULT 1.0,
	floors             JSONB NOT NULL DEFAULT '[]',
	bld_condition_type VARCHAR(100) NOT NULL DEFAULT '',
	picture_f          TEXT NOT NULL DEFAULT '',
	picture_b          TEXT NOT NULL DEFAULT '',
	picture_r          TEXT NOT NULL DEFAULT '',
	picture_l          TEXT NOT NULL DEFAULT '',
	address_no         VARCHAR(200) NOT NULL DEFAULT '',
	subdistrict        VARCHAR(100) NOT NULL DEFAULT '',
	district           VARCHAR(100) NOT NULL DEFAULT '',
	province           VARCHAR(100) NOT NULL DEFAULT '',
	postal_code        VARCHAR(20) NOT NULL DEFAULT '',
	created_by         BIGINT REFERENCES users(id),
	created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อัปเกรดตาราง buildings
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS address_no VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS subdistrict VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS district VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS province VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NOT NULL DEFAULT '';

-- ตารางสมาชิกในทีมของหัวหน้างาน
CREATE TABLE IF NOT EXISTS team_members (
	id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	supervisor_id  BIGINT NOT NULL REFERENCES users(id),
	subordinate_id BIGINT NOT NULL REFERENCES users(id),
	status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
	invited_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	responded_at   TIMESTAMPTZ,
	UNIQUE (supervisor_id, subordinate_id)
);

-- คำร้องขอแก้ไข/ตรวจสอบจากฝ่ายบัญชี
CREATE TABLE IF NOT EXISTS revision_requests (
	id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	public_id        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
	requested_by     BIGINT NOT NULL REFERENCES users(id),
	target_type      TEXT NOT NULL DEFAULT 'land' CHECK (target_type IN ('land','building','general')),
	target_code      TEXT,
	remark           TEXT NOT NULL,
	status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','resolved')),
	assigned_task_id BIGINT REFERENCES tasks(id),
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อัปเกรดตาราง tasks สำหรับ workflow การตรวจรับงานและกรอกข้อมูล
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submission_data JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS supervisor_feedback TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('pending','accepted','in_progress','submitted','revision_requested','done','cancelled'));

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_team_supervisor ON team_members(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_team_subordinate ON team_members(subordinate_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON revision_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_requested_by ON revision_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_land_code ON land_parcels(land_code);
CREATE INDEX IF NOT EXISTS idx_bldg_code ON buildings(bldg_code);
CREATE INDEX IF NOT EXISTS idx_bldg_land ON buildings(land_code);
`

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, schema)
	return err
}
