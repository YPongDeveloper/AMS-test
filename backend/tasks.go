package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const taskSelect = `
SELECT t.id, t.code, t.title, t.task_type, t.description, t.status,
       t.assigned_to, ua.display_name, ua.line_user_id,
       t.assigned_by, ub.display_name, ub.line_user_id,
       t.due_at, t.lat, t.lng, t.place_name, t.created_at, t.updated_at
FROM tasks t
JOIN users ua ON ua.id = t.assigned_to
JOIN users ub ON ub.id = t.assigned_by
`

func scanTask(row interface{ Scan(...any) error }) (*Task, error) {
	var t Task
	err := row.Scan(&t.ID, &t.Code, &t.Title, &t.TaskType, &t.Description, &t.Status,
		&t.AssignedTo, &t.AssigneeName, &t.AssigneeLine,
		&t.AssignedBy, &t.AssignerName, &t.AssignerLine,
		&t.DueAt, &t.Lat, &t.Lng, &t.PlaceName, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *server) loadTask(ctx context.Context, id int64) (*Task, error) {
	return scanTask(s.db.QueryRow(ctx, taskSelect+" WHERE t.id=$1", id))
}

// listTasks — ลูกน้องเห็นงานของตัวเอง, หัวหน้าเห็นทั้งหมด
func (s *server) listTasks(w http.ResponseWriter, r *http.Request) {
	c := getClaims(r)
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	q := taskSelect
	args := []any{}
	if c.Role != "supervisor" {
		q += " WHERE t.assigned_to=$1"
		args = append(args, c.UserID)
	}
	if st := r.URL.Query().Get("status"); st != "" && strings.Contains("pending,accepted,in_progress,done,cancelled", st) {
		if strings.Contains(q, "WHERE") {
			q += " AND"
		} else {
			q += " WHERE"
		}
		args = append(args, st)
		q += " t.status=$" + strconv.Itoa(len(args))
	}
	q += " ORDER BY t.created_at DESC LIMIT 200"

	rows, err := s.db.Query(ctx, q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "query error")
		return
	}
	defer rows.Close()
	tasks := []Task{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "scan error")
			return
		}
		tasks = append(tasks, *t)
	}
	writeJSON(w, http.StatusOK, tasks)
}

// createTask — หัวหน้าสั่งงาน → บันทึก + แจ้งลูกน้องทาง WS + ส่ง LINE Flex
func (s *server) createTask(w http.ResponseWriter, r *http.Request) {
	c := getClaims(r)
	var body struct {
		Title       string  `json:"title"`
		TaskType    string  `json:"task_type"`
		Description string  `json:"description"`
		AssignedTo  int64   `json:"assigned_to"`
		DueAt       *string `json:"due_at"`
		Lat         *float64 `json:"lat"`
		Lng         *float64 `json:"lng"`
		PlaceName   *string `json:"place_name"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	if body.Title == "" {
		writeErr(w, http.StatusBadRequest, "ต้องระบุชื่องาน")
		return
	}
	if body.TaskType == "" {
		body.TaskType = "survey"
	}
	if !strings.Contains("survey,inspect,other", body.TaskType) {
		writeErr(w, http.StatusBadRequest, "task_type ไม่ถูกต้อง")
		return
	}
	body.Description = strings.TrimSpace(body.Description)

	var dueAt any
	if body.DueAt != nil && strings.TrimSpace(*body.DueAt) != "" {
		t, err := time.Parse(time.RFC3339, strings.TrimSpace(*body.DueAt))
		if err != nil {
			writeErr(w, http.StatusBadRequest, "due_at ต้องเป็น ISO 8601")
			return
		}
		dueAt = t
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var exists int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM users WHERE id=$1`, body.AssignedTo).Scan(&exists); err != nil || exists == 0 {
		writeErr(w, http.StatusBadRequest, "ไม่พบบัญชีผู้รับงาน")
		return
	}

	var newID int64
	err := s.db.QueryRow(ctx, `
		INSERT INTO tasks (title, task_type, description, assigned_to, assigned_by, due_at, lat, lng, place_name)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		body.Title, body.TaskType, body.Description, body.AssignedTo, c.UserID, dueAt, body.Lat, body.Lng, body.PlaceName,
	).Scan(&newID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "บันทึกงานไม่สำเร็จ")
		return
	}

	task, err := s.loadTask(ctx, newID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "โหลดงานไม่สำเร็จ")
		return
	}

	// realtime หาผู้รับงาน
	s.hub.sendToUser(task.AssignedTo, WSMessage{Type: "task.new", Task: task})
	// LINE push หาผู้รับงาน
	go s.pushTaskToAssignee(task)

	writeJSON(w, http.StatusCreated, task)
}

// updateTaskStatus — ผู้รับงาน/หัวหน้าอัปเดตสถานะ → แจ้งทั้งสองฝั่ง + LINE หาหัวหน้าเมื่อเสร็จ
func (s *server) updateTaskStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if !strings.Contains("pending,accepted,in_progress,done,cancelled", body.Status) {
		writeErr(w, http.StatusBadRequest, "status ไม่ถูกต้อง")
		return
	}
	c := getClaims(r)
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var assignee, assigner int64
	err = s.db.QueryRow(ctx, `SELECT assigned_to, assigned_by FROM tasks WHERE id=$1`, id).
		Scan(&assignee, &assigner)
	if err != nil {
		writeErr(w, http.StatusNotFound, "ไม่พบงาน")
		return
	}
	if c.UserID != assignee && c.UserID != assigner && c.Role != "supervisor" {
		writeErr(w, http.StatusForbidden, "ไม่มีสิทธิ์แก้งานนี้")
		return
	}

	if _, err := s.db.Exec(ctx, `UPDATE tasks SET status=$1, updated_at=now() WHERE id=$2`, body.Status, id); err != nil {
		writeErr(w, http.StatusInternalServerError, "update error")
		return
	}
	task, err := s.loadTask(ctx, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "โหลดงานไม่สำเร็จ")
		return
	}

	s.hub.sendToUser(task.AssignedTo, WSMessage{Type: "task.update", Task: task})
	s.hub.sendToUser(task.AssignedBy, WSMessage{Type: "task.update", Task: task})
	if body.Status == "done" || body.Status == "cancelled" {
		go s.pushStatusToAssigner(task)
	}
	writeJSON(w, http.StatusOK, task)
}
