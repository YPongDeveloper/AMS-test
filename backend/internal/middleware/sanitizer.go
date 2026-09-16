package middleware

import (
	"bytes"
	"io"
	"net/http"
	"regexp"
	"strings"

	"ams-backend/internal/handler"
)

// Common SQL Injection signatures
var sqlInjectionRegexes = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(/\*.*?\*/|--[^\r\n]*|#[^\r\n]*)`),                                     // comments
	regexp.MustCompile(`(?i)\b(union\s+(all\s+)?select)\b`),                                          // UNION SELECT
	regexp.MustCompile(`(?i)\b(exec(\s+|\+)+(s|x)p\w+)\b`),                                           // exec sp / xp
	regexp.MustCompile(`(?i)\b(drop\s+table|drop\s+database|truncate\s+table)\b`),                    // DDL drop / truncate
	regexp.MustCompile(`(?i)\b(insert\s+into.+values|update.+set.+where|delete\s+from)\b.*(--|\b)`),  // chained DML injection
	regexp.MustCompile(`(?i)('\s*(or|and)\s*('|[0-9]+=[0-9]+|true=true))\b`),                        // ' OR '1'='1 or 1=1
	regexp.MustCompile(`(?i)\b(waitfor\s+delay|pg_sleep\s*\()\b`),                                    // Time-based blind SQLi
}

func containsSQLInjection(input string) bool {
	if len(input) == 0 {
		return false
	}
	// Decode basic URL encodings
	input = strings.ReplaceAll(input, "%20", " ")
	input = strings.ReplaceAll(input, "%27", "'")
	input = strings.ReplaceAll(input, "%22", "\"")
	input = strings.ReplaceAll(input, "%23", "#")
	input = strings.ReplaceAll(input, "%2D%2D", "--")

	for _, re := range sqlInjectionRegexes {
		if re.MatchString(input) {
			return true
		}
	}
	return false
}

// SQLInjectionSanitizer inspects query parameters and request bodies for malicious SQL injection patterns
func SQLInjectionSanitizer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Check Query Parameters
		for key, values := range r.URL.Query() {
			if containsSQLInjection(key) {
				handler.WriteErr(w, http.StatusBadRequest, "ตรวจพบอักขระหรือคำสั่งต้องห้าม (SQL Injection detected in query key)")
				return
			}
			for _, v := range values {
				if containsSQLInjection(v) {
					handler.WriteErr(w, http.StatusBadRequest, "ตรวจพบอักขระหรือคำสั่งต้องห้าม (SQL Injection detected in query parameter)")
					return
				}
			}
		}

		// 2. Check JSON Body (if Content-Type is application/json)
		contentType := r.Header.Get("Content-Type")
		if strings.Contains(contentType, "application/json") && r.Body != nil {
			bodyBytes, err := io.ReadAll(r.Body)
			if err != nil {
				handler.WriteErr(w, http.StatusBadRequest, "ไม่สามารถอ่านข้อมูลคำร้องได้")
				return
			}
			// Restore Body for next handlers
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

			// Check first 128KB of body to prevent regex CPU exhaustion
			checkLen := len(bodyBytes)
			if checkLen > 128*1024 {
				checkLen = 128 * 1024
			}
			if containsSQLInjection(string(bodyBytes[:checkLen])) {
				handler.WriteErr(w, http.StatusBadRequest, "ตรวจพบคำสั่งอันตรายในข้อมูลนำเข้า (SQL Injection detected in payload)")
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}
