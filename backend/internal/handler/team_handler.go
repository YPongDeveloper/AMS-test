package handler

import (
	"net/http"

	"ams-backend/internal/service"
)

type TeamHandler struct {
	svc *service.TeamService
}

func NewTeamHandler(svc *service.TeamService) *TeamHandler {
	return &TeamHandler{svc: svc}
}

type InviteRequest struct {
	Username string `json:"username"`
}

func (h *TeamHandler) Invite(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	var in InviteRequest
	if !ReadJSON(w, r, &in) || in.Username == "" {
		WriteErr(w, http.StatusBadRequest, "ต้องระบุ username ของพนักงาน")
		return
	}

	if err := h.svc.InviteByUsername(r.Context(), c, in.Username); err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "ส่งคำเชิญเข้าร่วมทีมเรียบร้อยแล้ว", nil)
}

func (h *TeamHandler) MyTeam(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	members, err := h.svc.ListMyTeam(r.Context(), c)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "ok", members)
}

func (h *TeamHandler) MyInvitations(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	invites, err := h.svc.ListMyInvitations(r.Context(), c)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "ok", invites)
}

type RespondRequest struct {
	SupervisorPublicID string `json:"supervisor_public_id"`
	Action             string `json:"action"` // accepted | declined
}

func (h *TeamHandler) Respond(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	var in RespondRequest
	if !ReadJSON(w, r, &in) {
		WriteErr(w, http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
		return
	}

	if err := h.svc.Respond(r.Context(), c, in.SupervisorPublicID, in.Action); err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "บันทึกการตอบรับคำเชิญเรียบร้อยแล้ว", nil)
}

func (h *TeamHandler) Remove(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	subordinatePublicID := r.PathValue("public_id")
	if err := h.svc.RemoveMember(r.Context(), c, subordinatePublicID); err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "นำพนักงานออกจากทีมเรียบร้อยแล้ว", nil)
}
