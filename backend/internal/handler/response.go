package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"ams-backend/internal/service"
)

// ---- Response Envelope: { status, message, data } ----

type Envelope struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

func WriteOK(w http.ResponseWriter, httpStatus int, message string, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(Envelope{Status: httpStatus, Message: message, Data: data})
}

func WriteErr(w http.ResponseWriter, httpStatus int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(Envelope{Status: httpStatus, Message: message, Data: nil})
}

// ---- JSON body ----

func ReadJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		WriteErr(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

// ---- Claims context ----

type ctxKey string

const claimsKey ctxKey = "claims"

func ContextWithClaims(ctx context.Context, c *service.Claims) context.Context {
	return context.WithValue(ctx, claimsKey, c)
}

func ClaimsFrom(r *http.Request) *service.Claims {
	c, _ := r.Context().Value(claimsKey).(*service.Claims)
	return c
}
