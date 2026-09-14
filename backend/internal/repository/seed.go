package repository

import (
	"context"
	"encoding/json"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"ams-backend/internal/model"
)

// Seed — สร้างบัญชีเริ่มต้น + mock data ของ dashboard (ทำครั้งแรกเมื่อตารางว่าง)
func Seed(ctx context.Context, pool *pgxpool.Pool) {
	seedAccounts(ctx, pool)
	seedDashboard(ctx, pool)
	seedLandsAndBuildings(ctx, pool)
}

func seedAccounts(ctx context.Context, pool *pgxpool.Pool) {
	accounts := []struct {
		username    string
		password    string
		displayName string
		role        model.Role
	}{
		{"admin", "admin", "ผู้ดูแลระบบ", model.RoleAdmin},
		{"leader", "leader", "หัวหน้างานสำรวจ", model.RoleSupervisor},
		{"normal", "normal", "เจ้าหน้าที่สำรวจ", model.RoleSubordinate},
	}
	for _, a := range accounts {
		var exists bool
		err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username=$1)`, a.username).Scan(&exists)
		if err != nil {
			log.Println("seed check:", err)
			continue
		}
		if exists {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(a.password), bcrypt.DefaultCost)
		if err != nil {
			continue
		}
		_, err = pool.Exec(ctx,
			`INSERT INTO users (username, password_hash, display_name, role) VALUES ($1,$2,$3,$4)`,
			a.username, string(hash), a.displayName, string(a.role))
		if err != nil {
			log.Printf("seed user %s: %v", a.username, err)
		} else {
			log.Printf("seeded account: %s (%s)", a.username, a.role)
		}
	}
}

func seedDashboard(ctx context.Context, pool *pgxpool.Pool) {
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dashboard_content WHERE key='dashboard')`).Scan(&exists); err != nil || exists {
		return
	}
	dashboard := map[string]any{
		"stats": []map[string]any{
			{"key": "parcels", "value": "1,284", "sub": "+12 this month", "delta": "+0.94%", "up": true, "chart": []int{22, 28, 25, 32, 30, 38, 42}},
			{"key": "buildings", "value": "3,562", "sub": "+47 this month", "delta": "+1.34%", "up": true, "chart": []int{30, 34, 31, 40, 38, 45, 52}},
			{"key": "pending", "value": "28", "sub": "จาก 156 รายการ", "delta": "-8.5%", "up": false, "chart": []int{40, 36, 32, 30, 28, 26, 24}},
			{"key": "synced", "value": "98.2%", "sub": "2,847 / 2,899", "delta": "+0.6%", "up": true, "chart": []int{88, 90, 92, 93, 95, 96, 98}},
		},
		"recent": []map[string]any{
			{"code": "LP-2569-0042", "name": "ที่ดินสถานีรังสิต", "type": "land", "progress": 78, "status": "synced"},
			{"code": "BL-2569-0117", "name": "อาคารสำนักงานใหญ่", "type": "building", "progress": 42, "status": "pending"},
			{"code": "LP-2569-0041", "name": "ที่ดินสถานีชุมทางบางซื่อ", "type": "land", "progress": 100, "status": "offline"},
			{"code": "BL-2569-0116", "name": "โกดังเก็บพัสดุ", "type": "building", "progress": 95, "status": "synced"},
		},
		"news": []map[string]any{
			{"tag": "ประกาศ", "title": "กำหนดยื่นแบบแสดงรายการภาษี ปี 2569", "date": "25 ก.ย. 2569", "tone": "gold"},
			{"tag": "อบรม", "title": "อบรมการใช้งานระบบสำรวจภาคสนาม", "date": "15 ต.ค. 2569", "tone": "blue"},
			{"tag": "ข่าว", "title": "ปรับปรุงระบบ PWA รองรับ iOS 17", "date": "10 ก.ย. 2569", "tone": "green"},
		},
		"upcoming": []map[string]any{
			{"date": "25 ก.ย.", "title": "ยื่นแบบภาษีที่ดิน Q3", "icon": "tax", "urgent": true},
			{"date": "30 ก.ย.", "title": "ครบกำหนดสำรวจอาคาร สถานีหลัก", "icon": "building", "urgent": false},
			{"date": "5 ต.ค.", "title": "ประชุมคณะกรรมการทรัพย์สิน", "icon": "calendar", "urgent": false},
		},
	}
	b, _ := json.Marshal(dashboard)
	// ส่งเป็น string เข้าคอลัมน์ JSONB (ส่ง []byte จะถูก encode เป็น bytea แล้ว error)
	if _, err := pool.Exec(ctx,
		`INSERT INTO dashboard_content (key, data) VALUES ('dashboard', $1) ON CONFLICT (key) DO NOTHING`,
		string(b)); err != nil {
		log.Println("seed dashboard:", err)
		return
	}
	log.Println("seeded dashboard mock data")
}

func seedLandsAndBuildings(ctx context.Context, pool *pgxpool.Pool) {
	// Seed Land
	var landExists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM land_parcels WHERE land_code='LP-2569-0043')`).Scan(&landExists); err == nil && !landExists {
		_, err = pool.Exec(ctx, `
			INSERT INTO land_parcels (land_code, srt_land_type, land_use, land_type, deed_no, dimension, width, length, picture_f, lat, lng)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, "LP-2569-0043", "ที่ดินสถานี", "ใช้เพื่อการขนส่ง", "โฉนด", "12345/2540", "2-1-50", 45.50, 120.00, "", 13.7563, 100.5018)
		if err != nil {
			log.Println("seed land error:", err)
		} else {
			log.Println("seeded land: LP-2569-0043")
		}
	}

	// Seed Building
	var bldgExists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM buildings WHERE bldg_code='BL-2569-0118')`).Scan(&bldgExists); err == nil && !bldgExists {
		floors := []model.FloorDetail{
			{FloorNumber: 1, BldgUse: "โถงต้อนรับและสำนักงานบริการ", Dim: floatPtr(300.0), Width: floatPtr(15.0), Length: floatPtr(20.0)},
			{FloorNumber: 2, BldgUse: "สำนักงานปฏิบัติการฝ่ายเดินรถ", Dim: floatPtr(300.0), Width: floatPtr(15.0), Length: floatPtr(20.0)},
			{FloorNumber: 3, BldgUse: "ห้องประชุมและฝ่ายบริหาร", Dim: floatPtr(300.0), Width: floatPtr(15.0), Length: floatPtr(20.0)},
		}
		floorsBytes, _ := json.Marshal(floors)

		_, err = pool.Exec(ctx, `
			INSERT INTO buildings (bldg_code, land_code, name, bldg_69, material_type, age, be_age, num_fl, floors, bld_condition_type, picture_f, picture_b, picture_r, picture_l)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, "BL-2569-0118", "LP-2569-0043", "อาคารสำนักงานใหญ่ ชั้น 1-3", "301 - อาคารสำนักงาน", "คอนกรีตเสริมเหล็ก", "28", "2541", 3.0, string(floorsBytes), "ดี", "", "", "", "")
		if err != nil {
			log.Println("seed building error:", err)
		} else {
			log.Println("seeded building: BL-2569-0118")
		}
	}
}

func floatPtr(f float64) *float64 {
	return &f
}

