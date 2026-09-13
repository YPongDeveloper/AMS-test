package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type claims struct {
	UserID int64  `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		// โหมด dev: สุ่มชั่วคราว (token จะหมดอายุเมื่อ restart) — production ควรตั้ง JWT_SECRET
		s = fmt.Sprintf("dev-secret-%d", time.Now().UnixNano())
		log.Println("WARN: JWT_SECRET not set — using ephemeral secret (tokens invalidate on restart)")
	}
	return []byte(s)
}

func signJWT(userID int64, role string) (string, error) {
	c := claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "ams-backend",
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(jwtSecret())
}

func parseJWT(tokenStr string) (*claims, error) {
	c := &claims{}
	_, err := jwt.ParseWithClaims(tokenStr, c, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	return c, nil
}
