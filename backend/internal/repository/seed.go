package repository

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"ams-backend/internal/model"
)

// Seed — สร้างบัญชีเริ่มต้น + mock data ของ dashboard (ทำครั้งแรกเมื่อตารางว่าง)
func Seed(ctx context.Context, pool *pgxpool.Pool) {
	seedAccounts(ctx, pool)
	seedDashboard(ctx, pool)
	seedLandsAndBuildings(ctx, pool)
	seedTeamMembers(ctx, pool)
	seedTasks(ctx, pool)
}

func seedAccounts(ctx context.Context, pool *pgxpool.Pool) {
	accounts := []struct {
		username    string
		password    string
		displayName string
		role        model.Role
	}{
		{"admin", "admin", "ผู้ดูแลระบบสูงสุด", model.RoleAdmin},
		{"leader", "leader", "หัวหน้างานสำรวจ", model.RoleSupervisor},
		{"normal", "normal", "นายสมศักดิ์ สำรวจดี (เจ้าหน้าที่สำรวจ 1)", model.RoleSubordinate},
		{"officer2", "officer2", "น.ส.วิภาดา รังวัดไว (เจ้าหน้าที่สำรวจ 2)", model.RoleSubordinate},
		{"officer3", "officer3", "นายธนกร ตรวจสอบการช่าง (เจ้าหน้าที่สำรวจ 3)", model.RoleSubordinate},
		{"officer4", "officer4", "นายปิยะพงษ์ ผังเมืองรังวัด (เจ้าหน้าที่สำรวจ 4)", model.RoleSubordinate},
		{"officer5", "officer5", "นายกิตติศักดิ์ ช่างสำรวจอิสระ (รอย้ายเข้าสังกัด)", model.RoleSubordinate},
		{"accountant", "accountant", "พนักงานบัญชีและการเงิน", model.RoleAccountant},
	}
	for _, a := range accounts {
		var exists bool
		err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username=$1)`, a.username).Scan(&exists)
		if err != nil {
			log.Println("seed check:", err)
			continue
		}
		if exists {
			// Update display_name to new format if needed
			_, _ = pool.Exec(ctx, `UPDATE users SET display_name=$1 WHERE username=$2`, a.displayName, a.username)
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

func seedTeamMembers(ctx context.Context, pool *pgxpool.Pool) {
	var supervisorID int64
	err := pool.QueryRow(ctx, `SELECT id FROM users WHERE username='leader'`).Scan(&supervisorID)
	if err != nil {
		return
	}
	subordinates := []string{"normal", "officer2", "officer3", "officer4"}
	for _, sub := range subordinates {
		var subID int64
		if err := pool.QueryRow(ctx, `SELECT id FROM users WHERE username=$1`, sub).Scan(&subID); err != nil {
			continue
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO team_members (supervisor_id, subordinate_id, status, invited_at, responded_at)
			VALUES ($1, $2, 'accepted', now() - interval '3 days', now() - interval '2 days')
			ON CONFLICT (supervisor_id, subordinate_id) DO UPDATE SET status='accepted'
		`, supervisorID, subID)
		if err != nil {
			log.Printf("seed team member %s: %v", sub, err)
		} else {
			log.Printf("seeded team member: leader -> %s", sub)
		}
	}
}

func seedTasks(ctx context.Context, pool *pgxpool.Pool) {
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM tasks`).Scan(&count); err == nil && count >= 10 {
		return
	}
	var supID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM users WHERE username='leader'`).Scan(&supID); err != nil {
		return
	}
	userIDs := make(map[string]int64)
	rows, err := pool.Query(ctx, `SELECT username, id FROM users WHERE username IN ('normal', 'officer2', 'officer3', 'officer4', 'officer5', 'leader')`)
	if err == nil {
		for rows.Next() {
			var u string
			var uid int64
			if err := rows.Scan(&u, &uid); err == nil {
				userIDs[u] = uid
			}
		}
		rows.Close()
	}

	tasks := []struct {
		title       string
		taskType    string
		targetType  string
		desc        string
		status      string
		assignee    string
		place       string
		lat         float64
		lng         float64
		dueOffsetH  int
		createdOffH int
		subData     string
	}{
		// 1. Pending (4 tasks)
		{"สำรวจรังวัดแนวเขตแปลงที่ดิน ย่านสถานีรถไฟอยุธยา", "survey", "land", "ตรวจสอบแนวเขตกรรมสิทธิ์ที่ดิน และบันทึกพิกัด GPS พร้อมขนาด ไร่-งาน-ตารางวา เพื่อนำข้อมูลเข้าสู่ระบบจัดการคำนวนภาษี", "pending", "normal", "สถานีอยุธยา (ย่านคลังสินค้า)", 14.3532, 100.5828, 8, -2, ""},
		{"ตรวจสอบสภาพอาคารสิ่งปลูกสร้าง ย่านกลางบางซื่อ", "inspect", "building", "ถ่ายรูป 4 ทิศ และตรวจนับจำนวนชั้น ขนาดพื้นที่ เพื่อบันทึกเข้าสู่ระบบจัดการคำนวนภาษี", "pending", "officer2", "สถานีกลางกรุงเทพอภิวัฒน์ / ย่านพหลโยธิน", 13.8045, 100.5398, 6, -3, ""},
		{"สำรวจพื้นที่เชิงพาณิชย์ให้เช่า สถานีรถไฟดอนเมือง", "survey", "land", "ตรวจสอบสัญญาเช่าและพื้นที่ใช้สอยจริงของร้านค้าและอาคารพาณิชย์บริเวณแนวเขตสถานีรถไฟดอนเมือง", "pending", "officer3", "สถานีรถไฟดอนเมือง (แนวเชื่อมต่อสนามบิน)", 13.913, 100.598, 4, -3, ""},
		{"สำรวจแนวเขตทางรถไฟสายแม่กลอง ย่านวงเวียนใหญ่", "survey", "land", "รังวัดแนวรั้วและเขตทางรถไฟสายแม่กลอง ตรวจสอบระยะร่นความปลอดภัยจากทางรถไฟ", "pending", "officer4", "สถานีรถไฟวงเวียนใหญ่ (สายแม่กลอง)", 13.7225, 100.4905, 9, -2, ""},

		// 2. In Progress / Accepted (5 tasks)
		{"รังวัดหมุดหลักเขตแนวทางรถไฟ โรงงานมักกะสัน แปลง A", "survey", "land", "ตรวจสภาพหลักหมุดคอนกรีตและรังวัดพิกัดดาวเทียม GNSS แปลงที่ดินโรงงานมักกะสัน", "in_progress", "normal", "โรงงานรถไฟมักกะสัน แปลง A", 13.7505, 100.5515, 5, -2, ""},
		{"รังวัดแนวเขตที่ดินสถานีรถไฟธนบุรี (ศิริราช)", "survey", "land", "สำรวจรังวัดแนวเขตที่ดินติดริมคลองบางกอกน้อย ตรวจสอบหลักเขตและแนวเขื่อนกันดิน", "in_progress", "officer2", "สถานีรถไฟธนบุรีเดิม (ริมคลองบางกอกน้อย)", 13.7588, 100.4855, 8, -2, ""},
		{"สำรวจเร่งด่วนแปลงย่านพหลโยธิน กม.11 (หัวหน้าลงพื้นที่เอง)", "survey", "land", "ภารกิจสำรวจตรวจสอบข้อพิพาทแนวเขตที่ดิน หัวหน้างานสำรวจลงพื้นที่กำกับดูแลและรังวัดด้วยตนเอง", "in_progress", "leader", "ย่านพหลโยธิน กม.11 (จุดตัดทางรถไฟ)", 13.825, 100.552, 7, -3, ""},
		{"สำรวจแปลงที่ดินว่างเปล่า ย่านคลองเตยริมแม่น้ำเจ้าพระยา", "survey", "land", "สำรวจรังวัดแนวเขตแปลงที่ดินริมแม่น้ำเจ้าพระยา และตรวจสอบระดับความลาดชันของตลิ่ง", "accepted", "officer3", "คลังสินค้าริมแม่น้ำเจ้าพระยา คลองเตย", 13.7085, 100.582, 10, -1, ""},
		{"สำรวจจุดตัดทางรถไฟและอาคารควบคุม ยมราช", "survey", "land", "ตรวจวัดขนาดทางกายภาพของจุดตัดทางรถไฟและตรวจสอบระยะปลอดภัยของอาคารควบคุม", "accepted", "officer4", "จุดตัดทางรถไฟยมราช ถนนเพชรบุรี", 13.757, 100.521, 4, -3, ""},

		// 3. Submitted (3 tasks)
		{"ตรวจสอบอาคารสถานีรถไฟประวัติศาสตร์ หัวลำโพง", "inspect", "building", "ตรวจสอบการอนุรักษ์อาคารสถาปัตยกรรมประวัติศาสตร์ และสำรวจพื้นที่เช่าบริการเชิงพาณิชย์", "submitted", "normal", "สถานีรถไฟกรุงเทพ (หัวลำโพง)", 13.738, 100.5165, 7, -2, `{"summary":"ส่งผลสำรวจอาคารประวัติศาสตร์หัวลำโพงเรียบร้อย"}`},
		{"สำรวจรังวัดที่ดินและแปลงสิ่งปลูกสร้าง ย่านสถานีนครปฐม", "survey", "land", "ลงพื้นที่สำรวจรังวัดแปลงที่ดินและหมุดหลักเขตแนวทางคู่ช่วงนครปฐม", "submitted", "officer2", "สถานีรถไฟนครปฐม (ย่านตะวันตก)", 13.821, 100.061, 8, -3, `{"summary":"รังวัดแปลงที่ดินย่านสถานีนครปฐมเรียบร้อย ขนาด 3-2-45 ไร่"}`},
		{"ตรวจสอบสัญญาเช่าที่ดินแปลงย่อย ย่านตลาดพลู", "inspect", "land", "ตรวจวัดขนาดพื้นที่เช่าแผงค้าและร้านอาหารริมทาง เปรียบเทียบกับแบบแปลนสัญญาเช่า", "submitted", "officer3", "สถานีรถไฟตลาดพลู (ริมทางรถไฟ)", 13.7198, 100.4789, 2, -4, `{"summary":"ตรวจนับพื้นที่เช่า 14 ล็อกย่อยถูกต้องตามสัญญา"}`},

		// 4. Done (3 tasks)
		{"ตรวจสอบอาคารที่พักอาศัยพนักงาน ย่านสถานีศาลายา", "inspect", "building", "ตรวจเช็กสภาพอาคารบ้านพักสวัสดิการพนักงาน สำรวจความชำรุดเสียหายเพื่อของบประมาณซ่อมบำรุง", "done", "normal", "บ้านพักพนักงานรถไฟ สถานีศาลายา", 13.8015, 100.3255, 6, -4, ""},
		{"ตรวจสอบเสาสัญญาณและอาคารโทรคมนาคม ย่านรังสิต", "inspect", "building", "ตรวจเช็กสภาพความปลอดภัยของเสาส่งสัญญาณรถไฟและแนวสายเคเบิลสื่อสารตามแนวเขต", "done", "officer4", "สถานีรถไฟรังสิต (ชุมทางรถไฟสายเหนือ)", 13.9895, 100.6035, 3, -4, ""},
		{"สำรวจหมุดหลักเขตและตรวจสอบอาคารสถานีบางบำหรุ", "survey", "land", "ตรวจสอบความถูกต้องของแนวเขตที่ดินบริเวณชานชาลาและสะพานลอยคนข้าม สถานีรถไฟบางบำหรุ", "done", "officer3", "สถานีรถไฟบางบำหรุ (สายสีแดงตลิ่งชัน)", 13.7885, 100.4805, 1, -5, ""},

		// 5. Cancelled (1 task)
		{"รังวัดจุดเชื่อมต่อแนวรถไฟความเร็วสูง ย่านเชียงรากน้อย", "survey", "land", "งานสำรวจชะลอและยกเลิกชั่วคราวเนื่องจากมีการปรับปรุงแนวเส้นทางร่วมกับหน่วยงานโครงการ", "cancelled", "officer2", "ชุมทางเชียงรากน้อย ปทุมธานี", 14.1205, 100.584, 8, -3, ""},

		// 6. ภารกิจวันก่อนหน้าและย้อนหลัง
		{"ตรวจสอบหมุดเขตแนวทางคู่ ชุมทางฉะเชิงเทรา", "survey", "land", "สำรวจหมุดหลักเขตแนวขยายทางคู่สายตะวันออก ลงบันทึกพิกัด GNSS สำเร็จเรียบร้อย", "done", "officer2", "สถานีรถไฟชุมทางฉะเชิงเทรา", 13.6965, 101.0745, -24, -30, ""},
		{"สำรวจพื้นที่เชิงพาณิชย์ ชุมทางบ้านภาชี", "survey", "land", "ตรวจเช็กสัญญาเช่าและแนวรั้วพื้นที่พาณิชย์ริมสถานีรถไฟชุมทางบ้านภาชี", "done", "officer3", "สถานีรถไฟชุมทางบ้านภาชี พระนครศรีอยุธยา", 14.449, 100.724, -26, -32, ""},
		{"ตรวจสอบอาคารสถานีรถไฟประวัติศาสตร์ ลพบุรี", "inspect", "building", "ตรวจสอบสภาพอาคารโบราณสถานสถานีรถไฟลพบุรี และสิ่งปลูกสร้างในย่านใกล้เคียง", "done", "normal", "สถานีรถไฟลพบุรี (ใกล้พระปรางค์สามยอด)", 14.7995, 100.6155, -25, -31, ""},
		{"สำรวจแปลงที่ดินว่างเปล่า ย่านแก่งคอย", "survey", "land", "เตรียมความพร้อมลงพื้นที่รังวัดแปลงที่ดินและหมุดหลักเขตแนวขยายทางรถไฟ", "pending", "officer4", "สถานีรถไฟชุมทางแก่งคอย สระบุรี", 14.586, 101.0025, 26, -2, ""},
		{"ตรวจสอบสิ่งปลูกสร้างและชานชาลา สถานีราชบุรี", "inspect", "building", "ตรวจรับงานปรับปรุงพื้นชานชาลาและสิ่งอำนวยความสะดวกผู้โดยสารสถานีรถไฟราชบุรี", "pending", "officer2", "สถานีรถไฟราชบุรี (ริมแม่น้ำแม่กลอง)", 13.529, 99.823, 30, -1, ""},
		{"สำรวจแนวเขตที่ดิน ย่านสถานีศิลาอาสน์", "survey", "land", "ตรวจสอบหมุดเขตและแนวเขตทางรถไฟสายเหนือ ย่านสถานีศิลาอาสน์ เพื่อจัดทำผังแม่บท", "done", "normal", "สถานีรถไฟศิลาอาสน์ อุตรดิตถ์", 17.653, 100.096, -48, -54, ""},
		{"ตรวจสอบสภาพสะพานรถไฟพระราม 6", "inspect", "building", "ตรวจสอบแนวสะพานรถไฟและพื้นที่โดยรอบเชิงสะพานพระราม 6 ฝั่งบางซื่อและฝั่งธนบุรี", "done", "officer3", "สะพานพระราม 6 (ข้ามแม่น้ำเจ้าพระยา)", 13.814, 100.514, -50, -56, ""},
		{"รังวัดแนวเขตทางรถไฟสายตะวันออก ย่านคลองตัน", "survey", "land", "สำรวจรังวัดแนวเขตทางรถไฟสายตะวันออก ตรวจสอบการรุกล้ำและระยะปลอดภัย", "done", "officer4", "สถานีรถไฟคลองตัน ถนนเพชรบุรีตัดใหม่", 13.743, 100.598, -96, -102, ""},
		{"ตรวจสอบอาคารสถานีมักกะสันเดิมและโรงเก็บรถจักร", "inspect", "building", "ตรวจสอบความมั่นคงแข็งแรงของอาคารโรงเก็บรถจักรและสิ่งอำนวยความสะดวกในย่านมักกะสัน", "done", "normal", "โรงเก็บรถจักรมักกะสัน", 13.752, 100.559, -98, -104, ""},
		{"สำรวจพื้นที่เชื่อมต่อแนวระบายน้ำ ย่านลาดกระบัง", "survey", "land", "ภารกิจสำรวจรังวัดโดยช่างสำรวจอิสระ (นอกสังกัด) เพื่อประสานงานการขุดลอกคูระบายน้ำริมทางรถไฟ", "pending", "officer5", "สถานีรถไฟลาดกระบัง (จุดตัดถนนฉลองกรุง)", 13.725, 100.778, 9, -2, ""},
	}

	for _, t := range tasks {
		assigneeID := userIDs[t.assignee]
		if assigneeID == 0 {
			assigneeID = userIDs["normal"]
		}
		if assigneeID == 0 {
			assigneeID = supID
		}
		dueAt := time.Now().Add(time.Duration(t.dueOffsetH) * time.Hour)
		createdAt := time.Now().Add(time.Duration(t.createdOffH) * time.Hour)

		var subJSON *string
		if t.subData != "" {
			subJSON = &t.subData
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO tasks (title, task_type, target_type, description, status, assigned_to, assigned_by, due_at, lat, lng, place_name, submission_data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
		`, t.title, t.taskType, t.targetType, t.desc, t.status, assigneeID, supID, dueAt, t.lat, t.lng, t.place, subJSON, createdAt)
		if err != nil {
			log.Printf("seed task '%s': %v", t.title, err)
		}
	}
	log.Println("seeded initial tasks into database")
}

