package handler

import (
	"net/http"

	"ams-backend/internal/model"
	"ams-backend/internal/service"
)

type UserHandler struct {
	users *service.UserService
}

func NewUserHandler(users *service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

// List — GET /api/users?role= (หัวหน้าเท่านั้น)
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	var role *string
	if v := r.URL.Query().Get("role"); v != "" {
		role = &v
	}
	users, err := h.users.List(r.Context(), role)
	if err != nil {
		WriteErr(w, http.StatusInternalServerError, "query error")
		return
	}
	WriteOK(w, http.StatusOK, "ok", users)
}

// ChangeRole — PATCH /api/users/{public_id}/role (ระบุ target ด้วย public_id)
func (h *UserHandler) ChangeRole(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var body struct {
		Role string `json:"role"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	if err := h.users.ChangeRole(r.Context(), c, r.PathValue("public_id"), model.Role(body.Role)); err != nil {
		switch err {
		case service.ErrSelfDemote, service.ErrLastSupervisor:
			WriteErr(w, http.StatusBadRequest, err.Error())
		case service.ErrBadRequest:
			WriteErr(w, http.StatusBadRequest, "role ไม่ถูกต้อง")
		case service.ErrForbidden:
			WriteErr(w, http.StatusForbidden, err.Error())
		default:
			WriteErr(w, http.StatusNotFound, "ไม่พบสมาชิก")
		}
		return
	}
	WriteOK(w, http.StatusOK, "เปลี่ยนบทบาทสำเร็จ", map[string]string{"role": body.Role})
}

// Create — POST /api/users (Admin เท่านั้น: สร้างผู้ใช้ใหม่)
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var body struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
		Role        string `json:"role"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	u, err := h.users.CreateUser(r.Context(), c, body.Username, body.Password, body.DisplayName, model.Role(body.Role))
	if err != nil {
		if err == service.ErrForbidden {
			WriteErr(w, http.StatusForbidden, err.Error())
		} else {
			WriteErr(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	WriteOK(w, http.StatusCreated, "เพิ่มผู้ใช้สำเร็จ", u)
}

// Update — PUT /api/users/{public_id} (Admin เท่านั้น: แก้ไขข้อมูลผู้ใช้)
func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var body struct {
		DisplayName string `json:"display_name"`
		Role        string `json:"role"`
		Status      string `json:"status"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	err := h.users.UpdateUser(r.Context(), c, r.PathValue("public_id"), body.DisplayName, model.Role(body.Role), body.Status)
	if err != nil {
		if err == service.ErrForbidden {
			WriteErr(w, http.StatusForbidden, err.Error())
		} else {
			WriteErr(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	WriteOK(w, http.StatusOK, "บันทึกข้อมูลผู้ใช้สำเร็จ", nil)
}

// ResetPassword — POST /api/users/{public_id}/password (Admin เท่านั้น: รีเซ็ตรหัสผ่าน)
func (h *UserHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var body struct {
		Password string `json:"password"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	err := h.users.ResetPassword(r.Context(), c, r.PathValue("public_id"), body.Password)
	if err != nil {
		if err == service.ErrForbidden {
			WriteErr(w, http.StatusForbidden, err.Error())
		} else {
			WriteErr(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	WriteOK(w, http.StatusOK, "รีเซ็ตรหัสผ่านสำเร็จ", nil)
}

// SetStatus — PATCH /api/users/{public_id}/status (Admin เท่านั้น: ปรับสถานะ Active / Resigned)
func (h *UserHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	var body struct {
		Status string `json:"status"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	err := h.users.SetStatus(r.Context(), c, r.PathValue("public_id"), body.Status)
	if err != nil {
		if err == service.ErrForbidden {
			WriteErr(w, http.StatusForbidden, err.Error())
		} else {
			WriteErr(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	WriteOK(w, http.StatusOK, "ปรับสถานะสำเร็จ", map[string]string{"status": body.Status})
}
