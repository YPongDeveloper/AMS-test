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

// ChangeRole — PATCH /api/users/{public_id}/role (หัวหน้าเท่านั้น; ระบุ target ด้วย public_id)
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
		case service.ErrSelfDemote:
			WriteErr(w, http.StatusBadRequest, err.Error())
		case service.ErrLastSupervisor:
			WriteErr(w, http.StatusBadRequest, err.Error())
		case service.ErrBadRequest:
			WriteErr(w, http.StatusBadRequest, "role ต้องเป็น supervisor หรือ subordinate")
		default:
			WriteErr(w, http.StatusNotFound, "ไม่พบสมาชิก")
		}
		return
	}
	WriteOK(w, http.StatusOK, "เปลี่ยนบทบาทสำเร็จ", map[string]string{"role": body.Role})
}
