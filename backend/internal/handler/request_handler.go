package handler

import (
	"net/http"

	"ams-backend/internal/service"
)

type RequestHandler struct {
	svc *service.RequestService
}

func NewRequestHandler(svc *service.RequestService) *RequestHandler {
	return &RequestHandler{svc: svc}
}

func (h *RequestHandler) Create(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	var in service.CreateRequestInput
	if !ReadJSON(w, r, &in) {
		WriteErr(w, http.StatusBadRequest, "ข้อมูลคำร้องไม่ถูกต้อง")
		return
	}

	req, err := h.svc.Create(r.Context(), c, in)
	if err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusCreated, "ส่งคำร้องขอแก้ไขเรียบร้อยแล้ว", req)
}

func (h *RequestHandler) List(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	var status *string
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	list, err := h.svc.List(r.Context(), c, status)
	if err != nil {
		WriteErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "ok", list)
}

type AssignRequest struct {
	TaskPublicID string `json:"task_public_id"`
}

func (h *RequestHandler) Assign(w http.ResponseWriter, r *http.Request) {
	c := ClaimsFrom(r)
	if c == nil {
		WriteErr(w, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
		return
	}
	publicID := r.PathValue("public_id")
	var in AssignRequest
	if !ReadJSON(w, r, &in) || in.TaskPublicID == "" {
		WriteErr(w, http.StatusBadRequest, "ต้องระบุ task_public_id")
		return
	}

	if err := h.svc.AssignTask(r.Context(), c, publicID, in.TaskPublicID); err != nil {
		WriteErr(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteOK(w, http.StatusOK, "ผูกคำร้องกับงานสำรวจเรียบร้อยแล้ว", nil)
}
