package handler

import (
	"net/http"

	"ams-backend/internal/model"
	"ams-backend/internal/service"
)

type BuildingHandler struct {
	buildings *service.BuildingService
}

func NewBuildingHandler(buildings *service.BuildingService) *BuildingHandler {
	return &BuildingHandler{buildings: buildings}
}

// List — GET /api/buildings?q=&land_code=
func (h *BuildingHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	landCode := r.URL.Query().Get("land_code")
	list, err := h.buildings.List(r.Context(), q, landCode)
	if err != nil {
		WriteErr(w, http.StatusInternalServerError, "ไม่สามารถดึงข้อมูลสิ่งปลูกสร้างได้")
		return
	}
	WriteOK(w, http.StatusOK, "ok", list)
}

// Get — GET /api/buildings/{public_id}
func (h *BuildingHandler) Get(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("public_id")
	bldg, err := h.buildings.Get(r.Context(), publicID)
	if err != nil {
		WriteErr(w, http.StatusNotFound, "ไม่พบข้อมูลสิ่งปลูกสร้าง")
		return
	}
	WriteOK(w, http.StatusOK, "ok", bldg)
}

// Create — POST /api/buildings
func (h *BuildingHandler) Create(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var in model.Building
	if !ReadJSON(w, r, &in) {
		return
	}
	created, err := h.buildings.Create(r.Context(), c, &in)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusCreated, "บันทึกข้อมูลสิ่งปลูกสร้างสำเร็จ", created)
}

// Update — PUT /api/buildings/{public_id}
func (h *BuildingHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("public_id")
	var in model.Building
	if !ReadJSON(w, r, &in) {
		return
	}
	updated, err := h.buildings.Update(r.Context(), publicID, &in)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "อัปเดตข้อมูลสิ่งปลูกสร้างสำเร็จ", updated)
}

// Delete — DELETE /api/buildings/{public_id}
func (h *BuildingHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("public_id")
	if err := h.buildings.Delete(r.Context(), publicID); err != nil {
		WriteErr(w, http.StatusInternalServerError, "ไม่สามารถลบข้อมูลได้")
		return
	}
	WriteOK(w, http.StatusOK, "ลบสิ่งปลูกสร้างสำเร็จ", nil)
}
