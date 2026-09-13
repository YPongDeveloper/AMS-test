package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var allowedOrigins map[string]bool

type server struct {
	db  *pgxpool.Pool
	hub *hub
}

func (s *server) auth(h http.Handler) http.Handler {
	return authMiddleware(h)
}

func (s *server) requireSup(h http.HandlerFunc) http.Handler {
	return requireSupervisor(h)
}

// handleMe — ข้อมูลผู้ใช้ปัจจุบัน
func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	c := getClaims(r)
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	var u User
	err := s.db.QueryRow(ctx,
		`SELECT id, line_user_id, display_name, picture_url, role, created_at FROM users WHERE id=$1`,
		c.UserID,
	).Scan(&u.ID, &u.LineUserID, &u.DisplayName, &u.PictureURL, &u.Role, &u.CreatedAt)
	if err != nil {
		writeErr(w, http.StatusNotFound, "ไม่พบผู้ใช้")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allow := "*"
		if origin != "" {
			if allowedOrigins[origin] {
				allow = origin
			} else if len(allowedOrigins) == 0 || allowedOrigins["*"] {
				allow = "*"
			} else {
				allow = ""
			}
		}
		if allow != "" {
			w.Header().Set("Access-Control-Allow-Origin", allow)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	allowedOrigins = map[string]bool{}
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGIN"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			allowedOrigins[o] = true
		}
	}

	pool, err := openDB()
	if err != nil {
		log.Fatal("DB: ", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	if err := migrate(ctx, pool); err != nil {
		log.Fatal("migrate: ", err)
	}
	cancel()
	log.Println("DB connected + schema ready")

	s := &server{db: pool, hub: newHub()}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "time": time.Now().Format(time.RFC3339)})
	})
	mux.HandleFunc("POST /api/auth/line", s.handleAuthLine)
	mux.Handle("GET /api/me", s.auth(http.HandlerFunc(s.handleMe)))
	mux.Handle("GET /api/users", s.auth(s.requireSup(s.listUsers)))
	mux.Handle("PATCH /api/users/{id}/role", s.auth(s.requireSup(s.changeRole)))
	mux.Handle("GET /api/tasks", s.auth(http.HandlerFunc(s.listTasks)))
	mux.Handle("POST /api/tasks", s.auth(s.requireSup(s.createTask)))
	mux.Handle("PATCH /api/tasks/{id}/status", s.auth(http.HandlerFunc(s.updateTaskStatus)))
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		handleWS(s.hub)(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("AMS backend listening on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(mux)))
}
