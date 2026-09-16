package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"ams-backend/internal/handler"
)

// clientBucket tracks token bucket for a client IP
type clientBucket struct {
	tokens     float64
	lastRefill time.Time
}

// RateLimiter implements a DDoS protection token-bucket rate limiter per IP address
type RateLimiter struct {
	mu           sync.Mutex
	clients      map[string]*clientBucket
	ratePerMin   float64
	burst        float64
	cleanupEvery time.Duration
}

// NewRateLimiter creates a thread-safe rate limiter
func NewRateLimiter(ratePerMin int, burst int) *RateLimiter {
	if ratePerMin <= 0 {
		ratePerMin = 60
	}
	if burst <= 0 {
		burst = 20
	}
	rl := &RateLimiter{
		clients:      make(map[string]*clientBucket),
		ratePerMin:   float64(ratePerMin),
		burst:        float64(burst),
		cleanupEvery: 5 * time.Minute,
	}
	go rl.startCleanup()
	return rl
}

func (rl *RateLimiter) startCleanup() {
	ticker := time.NewTicker(rl.cleanupEvery)
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-10 * time.Minute)
		for ip, b := range rl.clients {
			if b.lastRefill.Before(cutoff) {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func getClientIP(r *http.Request) string {
	// 1. Check X-Forwarded-For (Cloudflare, Render, AWS ALB, etc.)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	// 2. Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// 3. Fallback to RemoteAddr
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

func (rl *RateLimiter) allow(ip string) (bool, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, exists := rl.clients[ip]
	if !exists {
		rl.clients[ip] = &clientBucket{
			tokens:     rl.burst - 1,
			lastRefill: now,
		}
		return true, 0
	}

	// Refill tokens based on elapsed time: (rate / 60 seconds) * delta
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens += elapsed * (rl.ratePerMin / 60.0)
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.lastRefill = now

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return true, 0
	}

	// Calculate wait time until 1 token is available
	missing := 1.0 - b.tokens
	retryAfter := time.Duration(missing / (rl.ratePerMin / 60.0) * float64(time.Second))
	if retryAfter < time.Second {
		retryAfter = time.Second
	}
	return false, retryAfter
}

// Middleware returns an HTTP middleware enforcing DDoS rate limiting
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Bypass rate limiting for WebSocket upgrade requests and health checks
		if r.Header.Get("Upgrade") == "websocket" || r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		ip := getClientIP(r)
		allowed, retryAfter := rl.allow(ip)
		if !allowed {
			seconds := int(retryAfter.Seconds())
			if seconds < 1 {
				seconds = 1
			}
			w.Header().Set("Retry-After", fmt.Sprintf("%d", seconds))
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%.0f", rl.ratePerMin))
			handler.WriteErr(w, http.StatusTooManyRequests, "คำร้องขอถี่เกินกำหนด (DDoS Protection: Rate limit exceeded)")
			return
		}

		next.ServeHTTP(w, r)
	})
}
