package handler

import (
	"encoding/json"
	"net/http"

	"ams-backend/internal/repository"
)

type DashboardHandler struct {
	dash *repository.DashboardRepository
}

func NewDashboardHandler(dash *repository.DashboardRepository) *DashboardHandler {
	return &DashboardHandler{dash: dash}
}

// Get — GET /api/dashboard (เนื้อหา mock data จากหลังบ้าน)
func (h *DashboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	data, err := h.dash.Get(r.Context(), "dashboard")
	if err != nil {
		// ยังไม่มีข้อมูล seed — คืน object ว่าง
		WriteOK(w, http.StatusOK, "ok", json.RawMessage("{}"))
		return
	}
	WriteOK(w, http.StatusOK, "ok", json.RawMessage(data))
}

// Save — PUT /api/dashboard (admin — แก้เนื้อหา dashboard ได้)
func (h *DashboardHandler) Save(w http.ResponseWriter, r *http.Request) {
	var body json.RawMessage
	if !ReadJSON(w, r, &body) {
		return
	}
	if err := h.dash.Save(r.Context(), "dashboard", body); err != nil {
		WriteErr(w, http.StatusInternalServerError, "บันทึกไม่สำเร็จ")
		return
	}
	WriteOK(w, http.StatusOK, "บันทึกสำเร็จ", nil)
}
