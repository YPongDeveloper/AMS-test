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
		allowed[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allow := ""
		switch {
		case origin == "":
			allow = "*"
		case allowed[origin]:
			allow = origin
		case len(allowed) == 0 || allowed["*"]:
			allow = "*"
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
