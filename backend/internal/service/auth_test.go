package service

import (
	"testing"

	"ams-backend/internal/model"
)

func TestParseAccessToken(t *testing.T) {
	secret := "test-secret-key-32-chars-long!!"

	svc := NewAuthService(nil, nil, secret, "")

	testUsername := "testuser"
	user := &model.User{
		ID:          99,
		PublicID:    "usr-unit-test",
		Username:    &testUsername,
		DisplayName: "เจ้าหน้าที่ทดสอบ",
		Role:        "subordinate",
	}

	token, err := svc.signAccessToken(user)
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}
	if token == "" {
		t.Fatal("Expected non-empty token")
	}

	claims, err := ParseAccessToken(secret, token)
	if err != nil {
		t.Fatalf("Failed to parse token: %v", err)
	}

	if claims.PublicID != "usr-unit-test" {
		t.Errorf("Expected PublicID usr-unit-test, got %s", claims.PublicID)
	}
	if claims.Role != "subordinate" {
		t.Errorf("Expected Role subordinate, got %s", claims.Role)
	}
	if claims.UserID != 99 {
		t.Errorf("Expected UserID 99, got %d", claims.UserID)
	}

	// Verify invalid secret fails
	_, err = ParseAccessToken("wrong-secret-key-1234567890", token)
	if err == nil {
		t.Error("Expected error with wrong secret key, got nil")
	}
}

func TestTokenGeneration(t *testing.T) {
	t1 := newRefreshToken()
	t2 := newRefreshToken()

	if len(t1) != 64 {
		t.Errorf("Expected hex 64 chars, got %d", len(t1))
	}
	if t1 == t2 {
		t.Error("Expected uniquely generated refresh tokens")
	}

	h1 := hashToken(t1)
	h2 := hashToken(t1)
	if h1 != h2 {
		t.Error("Deterministic hash mismatch")
	}
}
