package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type User struct {
	ID          int64      `json:"id"`
	LineUserID  string     `json:"line_user_id"`
	DisplayName string     `json:"display_name"`
	PictureURL  *string    `json:"picture_url"`
	Role        string     `json:"role"`
	CreatedAt   time.Time  `json:"created_at"`
}

type Task struct {
	ID           int64      `json:"id"`
	Code         *string    `json:"code"`
	Title        string     `json:"title"`
	TaskType     string     `json:"task_type"`
	Description  string     `json:"description"`
	Status       string     `json:"status"`
	AssignedTo   int64      `json:"assigned_to"`
	AssigneeName string     `json:"assignee_name"`
	AssigneeLine string     `json:"-"`
	AssignedBy   int64      `json:"assigned_by"`
	AssignerName string     `json:"assigner_name"`
	AssignerLine string     `json:"-"`
	DueAt        *time.Time `json:"due_at"`
	Lat          *float64   `json:"lat"`
	Lng          *float64   `json:"lng"`
	PlaceName    *string    `json:"place_name"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// ---- context / auth helpers ----

type ctxKey string

const claimsKey ctxKey = "claims"

func withClaims(r *http.Request, c *claims) context.Context {
	return context.WithValue(r.Context(), claimsKey, c)
}

func getClaims(r *http.Request) *claims {
	c, _ := r.Context().Value(claimsKey).(*claims)
	return c
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			writeErr(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		c, err := parseJWT(strings.TrimPrefix(h, "Bearer "))
		if err != nil || c == nil {
			writeErr(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		next.ServeHTTP(w, r.WithContext(withClaims(r, c)))
	})
}

func requireSupervisor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := getClaims(r)
		if c == nil || c.Role != "supervisor" {
			writeErr(w, http.StatusForbidden, "ต้องเป็นหัวหน้างานเท่านั้น")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---- json helpers ----

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}
