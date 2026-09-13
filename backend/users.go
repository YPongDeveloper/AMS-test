package main

import (
	"context"
	"net/http"
	"strconv"
	"time"
)

// listUsers — หัวหน้าดูรายชื่อสมาชิกทั้งหมด (กรอง ?role=subordinate ได้)
func (s *server) listUsers(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	q := `SELECT id, line_user_id, display_name, picture_url, role, created_at FROM users`
	if role := r.URL.Query().Get("role"); role == "supervisor" || role == "subordinate" {
		q += " WHERE role='" + role + "'"
	}
	q += " ORDER BY created_at ASC LIMIT 500"
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "query error")
		return
	}
	defer rows.Close()
	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.LineUserID, &u.DisplayName, &u.PictureURL, &u.Role, &u.CreatedAt); err != nil {
			writeErr(w, http.StatusInternalServerError, "scan error")
			return
		}
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, users)
}

// changeRole — หัวหน้าเปลี่ยนบทบาทสมาชิก (ห้ามลดให้ไม่มีหัวหน้าเหลือในระบบ)
func (s *server) changeRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Role string `json:"role"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.Role != "supervisor" && body.Role != "subordinate" {
		writeErr(w, http.StatusBadRequest, "role ต้องเป็น supervisor หรือ subordinate")
		return
	}
	c := getClaims(r)
	if c.UserID == id && body.Role != "supervisor" {
		writeErr(w, http.StatusBadRequest, "ไม่สามารถลดบทบาทตัวเองได้")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if body.Role != "supervisor" {
		var supCount int
		_ = s.db.QueryRow(ctx, `SELECT count(*) FROM users WHERE role='supervisor'`).Scan(&supCount)
		var isSup bool
		_ = s.db.QueryRow(ctx, `SELECT role='supervisor' FROM users WHERE id=$1`, id).Scan(&isSup)
		if isSup && supCount <= 1 {
			writeErr(w, http.StatusBadRequest, "ต้องมีหัวหน้างานเหลืออย่างน้อย 1 คน")
			return
		}
	}
	tag, err := s.db.Exec(ctx, `UPDATE users SET role=$1 WHERE id=$2`, body.Role, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "update error")
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "ไม่พบสมาชิก")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}
