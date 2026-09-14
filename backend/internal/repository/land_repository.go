package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/model"
)

type LandRepository struct {
	db *pgxpool.Pool
}

func NewLandRepository(db *pgxpool.Pool) *LandRepository {
	return &LandRepository{db: db}
}

const landCols = `
l.id, l.public_id, l.land_code, l.srt_land_type, l.land_use, l.land_type,
l.deed_no, l.dimension, l.rai, l.ngan, l.wa, l.width, l.length, l.picture_f, l.lat, l.lng,
u.display_name, l.created_at, l.updated_at`

const landFrom = `
FROM land_parcels l
LEFT JOIN users u ON u.id = l.created_by
`

func scanLand(row interface{ Scan(...any) error }) (*model.LandParcel, error) {
	var l model.LandParcel
	err := row.Scan(
		&l.ID, &l.PublicID, &l.LandCode, &l.SRTLandType, &l.LandUse, &l.LandType,
		&l.DeedNo, &l.Dimension, &l.Rai, &l.Ngan, &l.Wa, &l.Width, &l.Length, &l.PictureF, &l.Lat, &l.Lng,
		&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *LandRepository) List(ctx context.Context, q string) ([]model.LandParcel, error) {
	sql := `SELECT ` + landCols + ` ` + landFrom
	var args []any
	if q != "" {
		sql += ` WHERE l.land_code ILIKE $1 OR l.deed_no ILIKE $1 OR l.srt_land_type ILIKE $1`
		args = append(args, "%"+q+"%")
	}
	sql += ` ORDER BY l.created_at DESC`

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []model.LandParcel{}
	for rows.Next() {
		l, err := scanLand(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *l)
	}
	return out, rows.Err()
}

func (r *LandRepository) FindByPublicID(ctx context.Context, publicID string) (*model.LandParcel, error) {
	sql := `SELECT ` + landCols + ` ` + landFrom + ` WHERE l.public_id = $1`
	return scanLand(r.db.QueryRow(ctx, sql, publicID))
}

func (r *LandRepository) Create(ctx context.Context, l *model.LandParcel, userID *int64) (*model.LandParcel, error) {
	rai, ngan, wa := 0, 0, 0.0
	if l.Rai != nil {
		rai = *l.Rai
	}
	if l.Ngan != nil {
		ngan = *l.Ngan
	}
	if l.Wa != nil {
		wa = *l.Wa
	}
	if l.Dimension == "" && (rai > 0 || ngan > 0 || wa > 0) {
		l.Dimension = fmt.Sprintf("%d-%d-%g", rai, ngan, wa)
	}

	row := r.db.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO land_parcels (
				land_code, srt_land_type, land_use, land_type, deed_no,
				dimension, rai, ngan, wa, width, length, picture_f, lat, lng, created_by
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			RETURNING *
		)
		SELECT ins.id, ins.public_id, ins.land_code, ins.srt_land_type, ins.land_use, ins.land_type,
		       ins.deed_no, ins.dimension, ins.rai, ins.ngan, ins.wa, ins.width, ins.length, ins.picture_f, ins.lat, ins.lng,
		       u.display_name, ins.created_at, ins.updated_at
		FROM ins
		LEFT JOIN users u ON u.id = ins.created_by
	`, l.LandCode, l.SRTLandType, l.LandUse, l.LandType, l.DeedNo,
		l.Dimension, rai, ngan, wa, l.Width, l.Length, l.PictureF, l.Lat, l.Lng, userID)
	return scanLand(row)
}

func (r *LandRepository) Update(ctx context.Context, publicID string, l *model.LandParcel) (*model.LandParcel, error) {
	rai, ngan, wa := 0, 0, 0.0
	if l.Rai != nil {
		rai = *l.Rai
	}
	if l.Ngan != nil {
		ngan = *l.Ngan
	}
	if l.Wa != nil {
		wa = *l.Wa
	}
	if l.Dimension == "" && (rai > 0 || ngan > 0 || wa > 0) {
		l.Dimension = fmt.Sprintf("%d-%d-%g", rai, ngan, wa)
	}

	row := r.db.QueryRow(ctx, `
		WITH upd AS (
			UPDATE land_parcels
			SET land_code = $2,
			    srt_land_type = $3,
			    land_use = $4,
			    land_type = $5,
			    deed_no = $6,
			    dimension = $7,
			    rai = $8,
			    ngan = $9,
			    wa = $10,
			    width = $11,
			    length = $12,
			    picture_f = $13,
			    lat = $14,
			    lng = $15,
			    updated_at = $16
			WHERE public_id = $1
			RETURNING *
		)
		SELECT upd.id, upd.public_id, upd.land_code, upd.srt_land_type, upd.land_use, upd.land_type,
		       upd.deed_no, upd.dimension, upd.rai, upd.ngan, upd.wa, upd.width, upd.length, upd.picture_f, upd.lat, upd.lng,
		       u.display_name, upd.created_at, upd.updated_at
		FROM upd
		LEFT JOIN users u ON u.id = upd.created_by
	`, publicID, l.LandCode, l.SRTLandType, l.LandUse, l.LandType, l.DeedNo,
		l.Dimension, rai, ngan, wa, l.Width, l.Length, l.PictureF, l.Lat, l.Lng, time.Now())
	return scanLand(row)
}

func (r *LandRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM land_parcels WHERE public_id = $1`, publicID)
	return err
}
