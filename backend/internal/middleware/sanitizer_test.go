package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestContainsSQLInjection(t *testing.T) {
	malicious := []string{
		"' OR '1'='1",
		"1; DROP TABLE users; --",
		"admin'--",
		"UNION SELECT null, username, password FROM users",
		"1' AND 1=1 --",
		"WAITFOR DELAY '0:0:5'",
		"SELECT * FROM land /* comment */",
	}

	for _, payload := range malicious {
		if !containsSQLInjection(payload) {
			t.Errorf("Expected payload %q to be detected as SQL injection", payload)
		}
	}

	safe := []string{
		"TK-2569-001",
		"แปลงที่ดินย่านสถานีอยุธยา",
		"John Doe",
		"surveyor@railway.co.th",
		"13.7563,100.5018",
		"100",
	}

	for _, input := range safe {
		if containsSQLInjection(input) {
			t.Errorf("Safe input %q was incorrectly flagged as SQL injection", input)
		}
	}
}

func TestSQLInjectionSanitizer_Middleware(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mw := SQLInjectionSanitizer(next)

	// Block malicious query param
	reqBad := httptest.NewRequest(http.MethodGet, "/api/lands?search=1%27%20OR%201=1--", nil)
	recBad := httptest.NewRecorder()
	mw.ServeHTTP(recBad, reqBad)
	if recBad.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request on SQLi query, got %d", recBad.Code)
	}

	// Allow safe query param
	reqGood := httptest.NewRequest(http.MethodGet, "/api/lands?search=TK-001", nil)
	recGood := httptest.NewRecorder()
	mw.ServeHTTP(recGood, reqGood)
	if recGood.Code != http.StatusOK {
		t.Errorf("Expected 200 OK on safe query, got %d", recGood.Code)
	}

	// Block malicious JSON body
	badJSON := []byte(`{"query": "admin' OR '1'='1"}`)
	reqBadBody := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(badJSON))
	reqBadBody.Header.Set("Content-Type", "application/json")
	recBadBody := httptest.NewRecorder()
	mw.ServeHTTP(recBadBody, reqBadBody)
	if recBadBody.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request on SQLi body, got %d", recBadBody.Code)
	}
}
