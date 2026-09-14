package middleware

import (
	"net/http"
	"strings"

	"ams-backend/internal/handler"
	"ams-backend/internal/service"
)

// Auth — อ่าน Bearer token → ตรวจ → ฝัง Claims ลง context (uid/role มาจาก token เสมอ)
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				handler.WriteErr(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			c, err := service.ParseAccessToken(secret, strings.TrimPrefix(h, "Bearer "))
			if err != nil {
				handler.WriteErr(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}
			next.ServeHTTP(w, r.WithContext(handler.ContextWithClaims(r.Context(), c)))
		})
	}
}

// RequireRole — จำกัด role เดียว
func RequireRole(role string, next http.Handler) http.Handler {
	return RequireAnyRole(role)(next)
}

// RequireAnyRole — ยอมรับหลาย role (เช่น user management: supervisor + admin)
func RequireAnyRole(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c := handler.ClaimsFrom(r)
			if c == nil || !allowed[c.Role] {
				handler.WriteErr(w, http.StatusForbidden, "ไม่มีสิทธิ์เข้าถึงส่วนนี้")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func CORS(allowedOrigins []string, next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range allowedOrigins {
		trimmed := strings.TrimRight(strings.TrimSpace(o), "/")
		if trimmed != "" {
			allowed[trimmed] = true
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawOrigin := r.Header.Get("Origin")
		origin := strings.TrimRight(strings.TrimSpace(rawOrigin), "/")
		allow := ""
		switch {
		case origin == "" || len(allowed) == 0 || allowed["*"]:
			allow = "*"
		case allowed[origin]:
			allow = origin
		case strings.HasSuffix(origin, ".vercel.app"):
			// อนุญาตทุก subdomain ของ vercel.app (เช่น ams-test-rust, ams-test-sukanan, preview branches)
			allow = rawOrigin
		case strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:"):
			allow = rawOrigin
		case strings.Contains(origin, "line.me"):
			allow = rawOrigin
		}
		if allow != "" {
			w.Header().Set("Access-Control-Allow-Origin", allow)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
