package middleware

import (
	"net/http"

	"ams-backend/internal/handler"
)

// SecurityHeaders applies OWASP recommended security headers
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()")
		next.ServeHTTP(w, r)
	})
}

// MaxBodySize restricts incoming request body size to prevent memory exhaustion (DDoS)
func MaxBodySize(maxBytes int64) func(http.Handler) http.Handler {
	if maxBytes <= 0 {
		maxBytes = 10 * 1024 * 1024 // 10MB default
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Recoverer catches unhandled panics and prevents the server process from crashing
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				handler.WriteErr(w, http.StatusInternalServerError, "เกิดข้อผิดพลาดภายในระบบ (Internal Server Error)")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
