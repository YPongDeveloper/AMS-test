package model

import "time"

type Role string

const (
	RoleAdmin       Role = "admin"
	RoleSupervisor  Role = "supervisor"
	RoleSubordinate Role = "subordinate"
)

const (
	TaskStatusPending    = "pending"
	TaskStatusAccepted   = "accepted"
	TaskStatusInProgress = "in_progress"
	TaskStatusDone       = "done"
	TaskStatusCancelled  = "cancelled"
)

func ValidStatus(s string) bool {
	switch s {
	case TaskStatusPending, TaskStatusAccepted, TaskStatusInProgress, TaskStatusDone, TaskStatusCancelled:
		return true
	}
	return false
}

func ValidTaskType(s string) bool {
	switch s {
	case "survey", "inspect", "other":
		return true
	}
	return false
}

func TaskTypeLabel(t string) string {
	switch t {
	case "survey":
		return "งานเก็บข้อมูล"
	case "inspect":
		return "งานตรวจสอบ"
	default:
		return "งานอื่น ๆ"
	}
}

// User — id (internal) ไม่ expose ออกนอกระบบ ใช้ PublicID (UUID) เสมอ
type User struct {
	ID           int64     `json:"-"`
	PublicID     string    `json:"public_id"`
	LineUserID   string    `json:"-"`
	Username     *string   `json:"username,omitempty"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	PictureURL   *string   `json:"picture_url"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

// Task — เช่นเดียวกับ User ใช้ PublicID แทน id ตัวเลข
type Task struct {
	ID               int64      `json:"-"`
	PublicID         string     `json:"public_id"`
	Code             *string    `json:"code"`
	Title            string     `json:"title"`
	TaskType         string     `json:"task_type"`
	Description      string     `json:"description"`
	Status           string     `json:"status"`
	AssigneePublicID string     `json:"assignee_public_id"`
	AssigneeName     string     `json:"assignee_name"`
	AssignerPublicID string     `json:"assigner_public_id"`
	AssignerName     string     `json:"assigner_name"`
	DueAt            *time.Time `json:"due_at"`
	Lat              *float64   `json:"lat"`
	Lng              *float64   `json:"lng"`
	PlaceName        *string    `json:"place_name"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// LandParcel — ชั้นข้อมูลแปลงที่ดิน (Data Layer ที่ดิน) ตรงตามสเปก 9 Attribute
type LandParcel struct {
	ID          int64     `json:"-"`
	PublicID    string    `json:"public_id"`
	LandCode    string    `json:"land_code"`     // Land_Code (Text 20)
	SRTLandType string    `json:"srt_land_type"` // SRT_Land_Type (Text 50)
	LandUse     string    `json:"land_use"`      // Land_Use (Text 50)
	LandType    string    `json:"land_type"`     // Land_Type (Text 50)
	DeedNo      string    `json:"deed_no"`       // Deed_No (Text 20)
	Dimension   string    `json:"dimension"`     // Dimension (Text 10) ไร่-งาน-วา
	Width       *float64  `json:"width"`         // Width (Float 10,2)
	Length      *float64  `json:"length"`        // Length (Float 10,2)
	PictureF    string    `json:"picture_f"`     // Picture_F (Text 254)
	Lat         *float64  `json:"lat,omitempty"`
	Lng         *float64  `json:"lng,omitempty"`
	CreatedBy   *string   `json:"created_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FloorDetail — รายละเอียดรายชั้น (Floors 1..10)
type FloorDetail struct {
	FloorNumber int      `json:"floor_number"`
	BldgUse     string   `json:"bldg_use"` // Bldg_Use_Fl (Text 254)
	Dim         *float64 `json:"dim"`      // Dim_Fl (Float 10,2) ตร.ม.
	Width       *float64 `json:"width"`    // Width_Fl (Float 10,2) เมตร
	Length      *float64 `json:"length"`   // Length_Fl (Float 10,2) เมตร
}

// Building — ชั้นข้อมูลอาคารและสิ่งปลูกสร้าง (Data Layer อาคารและสิ่งปลูกสร้าง) ตรงตามสเปก 51 Attribute
type Building struct {
	ID               int64         `json:"-"`
	PublicID         string        `json:"public_id"`
	BldgCode         string        `json:"bldg_code"`           // Bldg_Code (Text 20)
	LandCode         string        `json:"land_code"`           // แปลงที่ดินที่ตั้ง
	Name             string        `json:"name"`                // Name (Text 254)
	Bldg69           string        `json:"bldg_69"`             // Bldg_69 (Text 254) รหัส 69 แบบ
	MaterialType     string        `json:"material_type"`       // Material_Type (Text 50)
	Age              string        `json:"age"`                 // Age (Text 3) อายุปี
	BEAge            string        `json:"be_age"`              // B.E._Age (Text 20) พ.ศ. สร้าง
	NumFl            float64       `json:"num_fl"`              // Num_Fl (Float 3,2) จำนวนชั้น
	Floors           []FloorDetail `json:"floors"`              // ชั้น 1-10 (Bldg_Use_Fl, Dim_Fl, Width_Fl, Length_Fl)
	BLDConditionType string        `json:"bld_condition_type"`  // BLD_Condition_Type (Text 50)
	PictureF         string        `json:"picture_f"`           // Picture_F (Text 254) หน้า
	PictureB         string        `json:"picture_b"`           // Picture_B (Text 254) หลัง
	PictureR         string        `json:"picture_r"`           // Picture_R (Text 254) ขวา
	PictureL         string        `json:"picture_l"`           // Picture_L (Text 254) ซ้าย
	CreatedBy        *string       `json:"created_by,omitempty"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

