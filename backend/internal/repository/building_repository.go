package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"ams-backend/internal/model"
)

type BuildingRepository struct {
	db *pgxpool.Pool
}

func NewBuildingRepository(db *pgxpool.Pool) *BuildingRepository {
	return &BuildingRepository{db: db}
}

const bldgCols = `
b.id, b.public_id, b.bldg_code, b.land_code, b.name, b.bldg_69,
b.material_type, b.age, b.be_age, b.num_fl, b.floors, b.bld_condition_type,
b.picture_f, b.picture_b, b.picture_r, b.picture_l,
b.address_no, b.subdistrict, b.district, b.province, b.postal_code,
u.display_name, b.created_at, b.updated_at`

const bldgFrom = `
FROM buildings b
LEFT JOIN users u ON u.id = b.created_by
`

func scanBuilding(row interface{ Scan(...any) error }) (*model.Building, error) {
	var b model.Building
	var floorsJSON []byte
	err := row.Scan(
		&b.ID, &b.PublicID, &b.BldgCode, &b.LandCode, &b.Name, &b.Bldg69,
		&b.MaterialType, &b.Age, &b.BEAge, &b.NumFl, &floorsJSON, &b.BLDConditionType,
		&b.PictureF, &b.PictureB, &b.PictureR, &b.PictureL,
		&b.AddressNo, &b.Subdistrict, &b.District, &b.Province, &b.PostalCode,
		&b.CreatedBy, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(floorsJSON) > 0 {
		_ = json.Unmarshal(floorsJSON, &b.Floors)
	}
	if b.Floors == nil {
		b.Floors = []model.FloorDetail{}
	}
	return &b, nil
}

func (r *BuildingRepository) List(ctx context.Context, q, landCode string) ([]model.Building, error) {
	sql := `SELECT ` + bldgCols + ` ` + bldgFrom + ` WHERE 1=1`
	var args []any

	if landCode != "" {
		args = append(args, landCode)
		sql += ` AND b.land_code = $` + string(rune('0'+len(args)))
	}
	if q != "" {
		args = append(args, "%"+q+"%")
		paramIdx := string(rune('0' + len(args)))
		sql += ` AND (b.bldg_code ILIKE $` + paramIdx + ` OR b.name ILIKE $` + paramIdx + ` OR b.bldg_69 ILIKE $` + paramIdx + `)`
	}
	sql += ` ORDER BY b.created_at DESC`

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []model.Building{}
	for rows.Next() {
		b, err := scanBuilding(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}

func (r *BuildingRepository) FindByPublicID(ctx context.Context, publicID string) (*model.Building, error) {
	sql := `SELECT ` + bldgCols + ` ` + bldgFrom + ` WHERE b.public_id = $1`
	return scanBuilding(r.db.QueryRow(ctx, sql, publicID))
}

func (r *BuildingRepository) Create(ctx context.Context, b *model.Building, userID *int64) (*model.Building, error) {
	floorsJSON, _ := json.Marshal(b.Floors)
	row := r.db.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO buildings (
				bldg_code, land_code, name, bldg_69, material_type, age, be_age,
				num_fl, floors, bld_condition_type, picture_f, picture_b, picture_r, picture_l,
				address_no, subdistrict, district, province, postal_code, created_by
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
			RETURNING *
		)
		SELECT ins.id, ins.public_id, ins.bldg_code, ins.land_code, ins.name, ins.bldg_69,
		       ins.material_type, ins.age, ins.be_age, ins.num_fl, ins.floors, ins.bld_condition_type,
		       ins.picture_f, ins.picture_b, ins.picture_r, ins.picture_l,
		       ins.address_no, ins.subdistrict, ins.district, ins.province, ins.postal_code,
		       u.display_name, ins.created_at, ins.updated_at
		FROM ins
		LEFT JOIN users u ON u.id = ins.created_by
	`, b.BldgCode, b.LandCode, b.Name, b.Bldg69, b.MaterialType, b.Age, b.BEAge,
		b.NumFl, string(floorsJSON), b.BLDConditionType, b.PictureF, b.PictureB, b.PictureR, b.PictureL,
		b.AddressNo, b.Subdistrict, b.District, b.Province, b.PostalCode, userID)
	return scanBuilding(row)
}

func (r *BuildingRepository) Update(ctx context.Context, publicID string, b *model.Building) (*model.Building, error) {
	floorsJSON, _ := json.Marshal(b.Floors)
	row := r.db.QueryRow(ctx, `
		WITH upd AS (
			UPDATE buildings
			SET bldg_code = $2,
			    land_code = $3,
			    name = $4,
			    bldg_69 = $5,
			    material_type = $6,
			    age = $7,
			    be_age = $8,
			    num_fl = $9,
			    floors = $10,
			    bld_condition_type = $11,
			    picture_f = $12,
			    picture_b = $13,
			    picture_r = $14,
			    picture_l = $15,
			    address_no = $16,
			    subdistrict = $17,
			    district = $18,
			    province = $19,
			    postal_code = $20,
			    updated_at = $21
			WHERE public_id = $1
			RETURNING *
		)
		SELECT upd.id, upd.public_id, upd.bldg_code, upd.land_code, upd.name, upd.bldg_69,
		       upd.material_type, upd.age, upd.be_age, upd.num_fl, upd.floors, upd.bld_condition_type,
		       upd.picture_f, upd.picture_b, upd.picture_r, upd.picture_l,
		       upd.address_no, upd.subdistrict, upd.district, upd.province, upd.postal_code,
		       u.display_name, upd.created_at, upd.updated_at
		FROM upd
		LEFT JOIN users u ON u.id = upd.created_by
	`, publicID, b.BldgCode, b.LandCode, b.Name, b.Bldg69, b.MaterialType, b.Age, b.BEAge,
		b.NumFl, string(floorsJSON), b.BLDConditionType, b.PictureF, b.PictureB, b.PictureR, b.PictureL,
		b.AddressNo, b.Subdistrict, b.District, b.Province, b.PostalCode, time.Now())
	return scanBuilding(row)
}

func (r *BuildingRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM buildings WHERE public_id = $1`, publicID)
	return err
}
