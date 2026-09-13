package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"ams-backend/internal/model"
)

// LineNotifier — ส่งข้อความหาผู้ใช้ผ่าน LINE Messaging API (Flex Message)
type LineNotifier struct {
	token  string
	liffID string
	client *http.Client
}

func NewLineNotifier(token, liffID string) *LineNotifier {
	return &LineNotifier{token: token, liffID: liffID, client: &http.Client{Timeout: 15 * time.Second}}
}

func (n *LineNotifier) enabled() bool { return n.token != "" }

func (n *LineNotifier) liffURL(path string) string {
	return fmt.Sprintf("https://liff.line.me/%s%s", n.liffID, path)
}

func fmtDue(t *time.Time) string {
	if t == nil {
		return "-"
	}
	return t.Format("02/01/2006 15:04") + " น."
}

func flexRow(label, value string) map[string]any {
	return map[string]any{
		"type":   "box",
		"layout": "baseline",
		"contents": []any{
			map[string]any{"type": "text", "text": label, "color": "#8A8A8A", "size": "sm", "flex": 4},
			map[string]any{"type": "text", "text": value, "size": "sm", "flex": 8, "wrap": true},
		},
	}
}

func flexButton(label, uri string) map[string]any {
	return map[string]any{
		"type":   "button",
		"action": map[string]any{"type": "uri", "label": label, "uri": uri},
		"style":  "primary",
		"color":  "#1e3a8a",
	}
}

func placeText(t *model.Task) string {
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
	return place
}

// NotifyTaskNew — การ์ด "แจ้งงานใหม่" หาผู้รับงาน
func (n *LineNotifier) NotifyTaskNew(t *model.Task, assigneeLineUserID string) {
	desc := t.Description
	if desc == "" {
		desc = "-"
	}
	bubble := map[string]any{
		"type": "bubble",
		"header": map[string]any{
			"type":            "box",
			"layout":          "vertical",
			"backgroundColor": "#C81E1E",
			"contents": []any{
				map[string]any{"type": "text", "text": "แจ้งงานใหม่", "color": "#FFFFFF", "weight": "bold", "size": "lg"},
				map[string]any{"type": "text", "text": model.TaskTypeLabel(t.TaskType), "color": "#FFD9D9", "size": "sm"},
			},
		},
		"body": map[string]any{
			"type":   "box",
			"layout": "vertical",
			"contents": []any{
				flexRow("รหัสงาน", deref(t.Code, "-")),
				flexRow("ผู้สั่งงาน", t.AssignerName),
				flexRow("กำหนดส่ง", fmtDue(t.DueAt)),
				flexRow("พิกัดสถานที่", placeText(t)),
				map[string]any{"type": "separator", "margin": "md"},
				map[string]any{"type": "text", "text": desc, "wrap": true, "margin": "md", "size": "sm", "color": "#333333"},
			},
		},
		"footer": map[string]any{
			"type":     "box",
			"layout":   "vertical",
			"contents": []any{flexButton("ดูรายละเอียดงาน", n.liffURL("/tasks"))},
		},
	}
	n.push(assigneeLineUserID, map[string]any{
		"type":     "flex",
		"altText":  "แจ้งงานใหม่: " + t.Title,
		"contents": bubble,
	})
}

// NotifyStatus — แจ้งหัวหน้าเมื่องานเสร็จ/ถูกยกเลิก
func (n *LineNotifier) NotifyStatus(t *model.Task, assignerLineUserID string) {
	statusLabel, color := "เสร็จสิ้น", "#1B7F3B"
	if t.Status == model.TaskStatusCancelled {
		statusLabel, color = "ยกเลิก", "#C81E1E"
	}
	bubble := map[string]any{
		"type": "bubble",
		"body": map[string]any{
			"type":   "box",
			"layout": "vertical",
			"contents": []any{
				map[string]any{"type": "text", "text": "อัปเดตสถานะงาน", "weight": "bold", "size": "md", "color": color},
				map[string]any{"type": "text", "text": t.Title, "weight": "bold", "wrap": true, "margin": "sm"},
				flexRow("รหัสงาน", deref(t.Code, "-")),
				flexRow("ผู้ปฏิบัติงาน", t.AssigneeName),
				flexRow("สถานะ", statusLabel),
			},
		},
		"footer": map[string]any{
			"type":     "box",
			"layout":   "vertical",
			"contents": []any{flexButton("เปิดดูงาน", n.liffURL("/tasks"))},
		},
	}
	n.push(assignerLineUserID, map[string]any{
		"type":     "flex",
		"altText":  "อัปเดตสถานะงาน: " + t.Title,
		"contents": bubble,
	})
}

func deref(s *string, def string) string {
	if s == nil {
		return def
	}
	return *s
}

func (n *LineNotifier) push(lineUserID string, message map[string]any) {
	if !n.enabled() || lineUserID == "" {
		log.Println("LINE push skipped (token ยังไม่ตั้ง), to:", lineUserID)
		return
	}
	payload := map[string]any{"to": lineUserID, "messages": []any{message}}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.line.me/v2/bot/message/push", bytes.NewReader(b))
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+n.token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := n.client.Do(req)
	if err != nil {
		log.Println("LINE push error:", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("LINE push failed: status=%d to=%s", resp.StatusCode, lineUserID)
	}
}
