package handler

import (
	"errors"
	"net/http"

	"ams-backend/internal/service"
)

type TaskHandler struct {
	tasks *service.TaskService
}

func NewTaskHandler(tasks *service.TaskService) *TaskHandler {
	return &TaskHandler{tasks: tasks}
}

// List — GET /api/tasks?status= (ลูกน้อง=งานตัวเอง, หัวหน้า=ทั้งหมด; มาจาก token)
func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var status *string
	if v := r.URL.Query().Get("status"); v != "" {
		status = &v
	}
	tasks, err := h.tasks.ListFor(r.Context(), c, status)
	if err != nil {
		WriteErr(w, http.StatusInternalServerError, "query error")
		return
	}
	WriteOK(w, http.StatusOK, "ok", tasks)
}

// Create — POST /api/tasks (หัวหน้าเท่านั้น)
func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var in service.CreateTaskInput
	if !ReadJSON(w, r, &in) {
		return
	}
	task, err := h.tasks.Create(r.Context(), c, in)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusCreated, "สั่งงานสำเร็จ — แจ้งเตือนผู้รับแล้ว", task)
}

// UpdateStatus — PATCH /api/tasks/{public_id}/status (ผู้รับงาน/หัวหน้า)
func (h *TaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var body struct {
		Status string `json:"status"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	task, err := h.tasks.UpdateStatus(r.Context(), c, r.PathValue("public_id"), body.Status)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			WriteErr(w, http.StatusNotFound, "ไม่พบงาน")
			return
		}
		if errors.Is(err, service.ErrForbidden) {
			WriteErr(w, http.StatusForbidden, "ไม่มีสิทธิ์แก้งานนี้")
			return
		}
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "อัปเดตสถานะสำเร็จ", task)
}
