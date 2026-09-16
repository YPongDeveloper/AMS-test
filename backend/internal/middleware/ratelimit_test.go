package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter_Allow(t *testing.T) {
	rl := NewRateLimiter(60, 5)
	ip := "192.168.1.100"

	for i := 1; i <= 5; i++ {
		allowed, wait := rl.allow(ip)
		if !allowed {
			t.Fatalf("Request %d should be allowed, got wait %v", i, wait)
		}
	}

	allowed, wait := rl.allow(ip)
	if allowed {
		t.Fatalf("Request 6 exceeded burst limit and should be rate limited")
	}
	if wait <= 0 {
		t.Errorf("Expected positive wait duration, got %v", wait)
	}

	otherIP := "10.0.0.1"
	allowedOther, _ := rl.allow(otherIP)
	if !allowedOther {
		t.Fatalf("Different IP should have its own token bucket and be allowed")
	}
}

func TestRateLimiter_Middleware(t *testing.T) {
	rl := NewRateLimiter(60, 2)
	handlerCalled := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled++
		w.WriteHeader(http.StatusOK)
	})

	limiterMiddleware := rl.Middleware(next)

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "172.16.0.5:12345"

	rec1 := httptest.NewRecorder()
	limiterMiddleware.ServeHTTP(rec1, req)
	if rec1.Code != http.StatusOK {
		t.Errorf("Req 1 expected 200, got %d", rec1.Code)
	}

	rec2 := httptest.NewRecorder()
	limiterMiddleware.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusOK {
		t.Errorf("Req 2 expected 200, got %d", rec2.Code)
	}

	rec3 := httptest.NewRecorder()
	limiterMiddleware.ServeHTTP(rec3, req)
	if rec3.Code != http.StatusTooManyRequests {
		t.Errorf("Req 3 expected 429, got %d", rec3.Code)
	}
	if rec3.Header().Get("Retry-After") == "" {
		t.Errorf("Expected Retry-After header on 429 response")
	}
}

func TestGetClientIP(t *testing.T) {
	r1 := httptest.NewRequest(http.MethodGet, "/", nil)
	r1.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18, 150.172.238.178")
	if ip := getClientIP(r1); ip != "203.0.113.195" {
		t.Errorf("Expected first IP from X-Forwarded-For, got %s", ip)
	}

	r2 := httptest.NewRequest(http.MethodGet, "/", nil)
	r2.Header.Set("X-Real-IP", "198.51.100.22")
	if ip := getClientIP(r2); ip != "198.51.100.22" {
		t.Errorf("Expected X-Real-IP, got %s", ip)
	}

	r3 := httptest.NewRequest(http.MethodGet, "/", nil)
	r3.RemoteAddr = "192.0.2.1:54321"
	if ip := getClientIP(r3); ip != "192.0.2.1" {
		t.Errorf("Expected RemoteAddr host without port, got %s", ip)
	}
}
