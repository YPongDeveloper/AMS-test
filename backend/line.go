package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

var httpClient = &http.Client{Timeout: 15 * time.Second}

func lineToken() string  { return os.Getenv("LINE_CHANNEL_ACCESS_TOKEN") }
func liffID() string     { return os.Getenv("LIFF_ID") }

func taskTypeLabel(t string) string {
	switch t {
	case "survey":
		return "งานเก็บข้อมูล"
	case "inspect":
		return "งานตรวจสอบ"
	default:
		return "งานอื่น ๆ"
	}
}

func fmtDue(t *time.Time) string {
	if t == nil {
		return "-"
	}
	return t.Format("02/01/2006 15:04") + " น."
}

// pushTaskToAssignee — ส่ง Flex Message แจ้งงานใหม่ (รูปแบบเหมือนการ์ดแจ้งออเดอร์)
func (s *server) pushTaskToAssignee(t *Task) {
	liffURL := fmt.Sprintf("https://liff.line.me/%s/tasks", liffID())
	place := "-"
	if t.PlaceName != nil && *t.PlaceName != "" {
		place = *t.PlaceName
	}
	if t.Lat != nil && t.Lng != nil {
		coord := fmt.Sprintf("%.6f, %.6f", *t.Lat, *t.Lng)
		if place == "-" {
			place = coord
		} else {
			place += " (" + coord + ")"
		}
	}

	desc := t.Description
	if desc == "" {
		desc = "-"
	}

	bubble := map[string]any{
		"type": "bubble",
		"header": map[string]any{
			"type":           "box",
			"layout":         "vertical",
			"backgroundColor": "#C81E1E",
			"contents": []any{
				map[string]any{"type": "text", "text": "แจ้งงานใหม่", "color": "#FFFFFF", "weight": "bold", "size": "lg"},
				map[string]any{"type": "text", "text": taskTypeLabel(t.TaskType), "color": "#FFD9D9", "size": "sm"},
			},
		},
		"body": map[string]any{
			"type": "box",
			"layout": "vertical",
			"contents": []any{
				row("รหัสงาน", deref(t.Code, "-")),
				row("ผู้สั่งงาน", t.AssignerName),
				row("กำหนดส่ง", fmtDue(t.DueAt)),
				row("พิกัดสถานที่", place),
				map[string]any{"type": "separator", "margin": "md"},
				map[string]any{"type": "text", "text": desc, "wrap": true, "margin": "md", "size": "sm", "color": "#333333"},
			},
		},
		"footer": map[string]any{
			"type":     "box",
			"layout":   "vertical",
			"contents": []any{
				map[string]any{
					"type":   "button",
					"action": map[string]any{"type": "uri", "label": "ดูรายละเอียดงาน", "uri": liffURL},
					"style":  "primary",
					"color":  "#1e3a8a",
				},
			},
		},
	}
	msg := map[string]any{
		"type":    "flex",
		"altText": "แจ้งงานใหม่: " + t.Title,
		"contents": bubble,
	}
	s.pushTo(t.AssigneeLine, msg)
}

// pushStatusToAssigner — แจ้งหัวหน้าเมื่องานเสร็จ/ถูกยกเลิก
func (s *server) pushStatusToAssigner(t *Task) {
	liffURL := fmt.Sprintf("https://liff.line.me/%s/tasks", liffID())
	statusLabel := "เสร็จสิ้น"
	color := "#1B7F3B"
	if t.Status == "cancelled" {
		statusLabel = "ยกเลิก"
		color = "#C81E1E"
	}
	bubble := map[string]any{
		"type": "bubble",
		"body": map[string]any{
			"type": "box",
			"layout": "vertical",
			"contents": []any{
				map[string]any{"type": "text", "text": "อัปเดตสถานะงาน", "weight": "bold", "size": "md", "color": color},
				map[string]any{"type": "text", "text": t.Title, "weight": "bold", "wrap": true, "margin": "sm"},
				row("รหัสงาน", deref(t.Code, "-")),
				row("ผู้ปฏิบัติงาน", t.AssigneeName),
				row("สถานะ", statusLabel),
			},
		},
		"footer": map[string]any{
			"type": "box",
			"layout": "vertical",
			"contents": []any{
				map[string]any{
					"type":   "button",
					"action": map[string]any{"type": "uri", "label": "เปิดดูงาน", "uri": liffURL},
					"style":  "primary",
					"color":  "#1e3a8a",
				},
			},
		},
	}
	msg := map[string]any{"type": "flex", "altText": "อัปเดตสถานะงาน: " + t.Title, "contents": bubble}
	s.pushTo(t.AssignerLine, msg)
}

func row(label, value string) map[string]any {
	return map[string]any{
		"type": "box",
		"layout": "baseline",
		"contents": []any{
			map[string]any{"type": "text", "text": label, "color": "#8A8A8A", "size": "sm", "flex": 4},
			map[string]any{"type": "text", "text": value, "size": "sm", "flex": 8, "wrap": true},
		},
	}
}

func deref(s *string, def string) string {
	if s == nil {
		return def
	}
	return *s
}

// pushTo — ส่งข้อความผ่าน LINE Messaging API (ข้ามถ้ายังไม่ได้ตั้ง token)
func (s *server) pushTo(lineUserID string, message map[string]any) {
	token := lineToken()
	if token == "" {
		log.Println("LINE push skipped (LINE_CHANNEL_ACCESS_TOKEN not set), to:", lineUserID)
		return
	}
	if strings.TrimSpace(lineUserID) == "" {
		return
	}
	payload := map[string]any{
		"to":       lineUserID,
		"messages": []any{message},
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.line.me/v2/bot/message/push", bytes.NewReader(b))
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		log.Println("LINE push error:", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		log.Printf("LINE push failed: status=%d to=%s", resp.StatusCode, lineUserID)
	}
}
