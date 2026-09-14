package handler

import (
	"net/http"

	"ams-backend/internal/model"
	"ams-backend/internal/service"
)

type LandHandler struct {
	lands *service.LandService
}

func NewLandHandler(lands *service.LandService) *LandHandler {
	return &LandHandler{lands: lands}
}

// List — GET /api/lands?q=
func (h *LandHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	list, err := h.lands.List(r.Context(), q)
	if err != nil {
		WriteErr(w, http.StatusInternalServerError, "ไม่สามารถดึงข้อมูลที่ดินได้")
		return
	}
	WriteOK(w, http.StatusOK, "ok", list)
}

// Get — GET /api/lands/{public_id}
func (h *LandHandler) Get(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("public_id")
	land, err := h.lands.Get(r.Context(), publicID)
	if err != nil {
		WriteErr(w, http.StatusNotFound, "ไม่พบข้อมูลแปลงที่ดิน")
		return
	}
	WriteOK(w, http.StatusOK, "ok", land)
}

// Create — POST /api/lands
func (h *LandHandler) Create(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var in model.LandParcel
	if !ReadJSON(w, r, &in) {
		return
	}
	created, err := h.lands.Create(r.Context(), c, &in)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusCreated, "บันทึกข้อมูลแปลงที่ดินสำเร็จ", created)
}

// Update — PUT /api/lands/{public_id}
func (h *LandHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("public_id")
	var in model.LandParcel
	if !ReadJSON(w, r, &in) {
		return
	}
	updated, err := h.lands.Update(r.Context(), publicID, &in)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "อัปเดตข้อมูลแปลงที่ดินสำเร็จ", updated)
}

// Delete — DELETE /api/lands/{public_id}
func (h *LandHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("public_id")
	if err := h.lands.Delete(r.Context(), publicID); err != nil {
		WriteErr(w, http.StatusInternalServerError, "ไม่สามารถลบข้อมูลได้")
		return
	}
	WriteOK(w, http.StatusOK, "ลบแปลงที่ดินสำเร็จ", nil)
}
