package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type lineVerifyResp struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	Error   string `json:"error_description,omitempty"`
}

// handleAuthLine รับ ID Token จาก LIFF → ตรวจกับ LINE → upsert user → ออก JWT ของระบบ
func (s *server) handleAuthLine(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"id_token"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.IDToken) == "" {
		writeErr(w, http.StatusBadRequest, "id_token is required")
		return
	}

	form := url.Values{"id_token": {body.IDToken}}
	if cid := os.Getenv("LINE_CHANNEL_ID"); cid != "" {
		form.Set("client_id", cid) // ตรวจ audience ด้วย
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.PostForm("https://api.line.me/oauth2/v2.1/verify", form)
	if err != nil {
		log.Println("LINE verify error:", err)
		writeErr(w, http.StatusBadGateway, "ตรวจสอบกับ LINE ไม่สำเร็จ")
		return
	}
	defer resp.Body.Close()
	var lv lineVerifyResp
	if err := json.NewDecoder(resp.Body).Decode(&lv); err != nil || resp.StatusCode != 200 {
		log.Printf("LINE verify failed: status=%d body=%v", resp.StatusCode, lv)
		writeErr(w, http.StatusUnauthorized, "ID Token ไม่ถูกต้อง")
		return
	}
	if lv.Sub == "" {
		writeErr(w, http.StatusUnauthorized, "ID Token ไม่ถูกต้อง")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var (
		id      int64
		role    string
		name    = lv.Name
		picture = strings.TrimSpace(lv.Picture)
	)
	if name == "" {
		name = "ผู้ใช้ LINE"
	}
	var picAny any
	if picture != "" {
		picAny = picture
	}

	err = s.db.QueryRow(ctx,
		`SELECT id, role FROM users WHERE line_user_id=$1`, lv.Sub,
	).Scan(&id, &role)
	if err != nil {
		// ผู้ใช้ใหม่: คนแรกของระบบ = หัวหน้างาน ที่เหลือ = ลูกน้อง
		var count int
		_ = s.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count)
		newRole := "subordinate"
		if count == 0 {
			newRole = "supervisor"
		}
		err = s.db.QueryRow(ctx,
			`INSERT INTO users (line_user_id, display_name, picture_url, role)
			 VALUES ($1,$2,$3,$4) RETURNING id, role`,
			lv.Sub, name, picAny, newRole,
		).Scan(&id, &role)
		if err != nil {
			log.Println("insert user:", err)
			writeErr(w, http.StatusInternalServerError, "สร้างบัญชีไม่สำเร็จ")
			return
		}
		log.Printf("new user id=%d role=%s line=%s", id, role, lv.Sub)
	} else {
		_, _ = s.db.Exec(ctx,
			`UPDATE users SET display_name=$1, picture_url=$2 WHERE id=$3`,
			name, picAny, id,
		)
	}

	token, err := signJWT(id, role)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "ออก token ไม่สำเร็จ")
		return
	}

	u := User{ID: id, LineUserID: lv.Sub, DisplayName: name, Role: role}
	if picture != "" {
		u.PictureURL = &picture
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u, "is_new": fmt.Sprint(role != "")})
}
