package handler

import (
	"net/http"

	"ams-backend/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

// Login — POST /api/auth/line { id_token }
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"id_token"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	user, pair, err := h.auth.LoginWithLineIDToken(r.Context(), body.IDToken)
	if err != nil {
		WriteErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "เข้าสู่ระบบสำเร็จ", map[string]any{
		"user":  user,
		"token": pair,
	})
}

// Refresh — POST /api/auth/refresh { refresh_token }
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	if body.RefreshToken == "" {
		WriteErr(w, http.StatusBadRequest, "refresh_token is required")
		return
	}
	user, pair, err := h.auth.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		WriteErr(w, http.StatusUnauthorized, "refresh token ไม่ถูกต้องหรือหมดอายุ")
		return
	}
	WriteOK(w, http.StatusOK, "ต่ออายุ token สำเร็จ", map[string]any{
		"user":  user,
		"token": pair,
	})
}

// Logout — POST /api/auth/logout { refresh_token }
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !ReadJSON(w, r, &body) {
		return
	}
	if err := h.auth.Logout(r.Context(), body.RefreshToken); err != nil {
		WriteErr(w, http.StatusInternalServerError, "logout ไม่สำเร็จ")
		return
	}
	WriteOK(w, http.StatusOK, "ออกจากระบบสำเร็จ", nil)
}

// Me — GET /api/me (uid มาจาก Bearer token เสมอ)
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	user, err := h.auth.Me(r.Context(), c.UserID)
	if err != nil {
		WriteErr(w, http.StatusNotFound, "ไม่พบผู้ใช้")
		return
	}
	WriteOK(w, http.StatusOK, "ok", user)
}
