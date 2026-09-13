package config

import (
	"log"
	"os"
	"strings"
)

// Config รวมค่าที่อ่านจาก environment ทั้งหมด
type Config struct {
	Port                   string
	DatabaseURL            string
	JWTSecret              string
	LineChannelID          string
	LineChannelAccessToken string
	LiffID                 string
	AllowedOrigins         []string
}

func Load() Config {
	cfg := Config{
		Port:                   os.Getenv("PORT"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		JWTSecret:              os.Getenv("JWT_SECRET"),
		LineChannelID:          os.Getenv("LINE_CHANNEL_ID"),
		LineChannelAccessToken: os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"),
		LiffID:                 os.Getenv("LIFF_ID"),
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.JWTSecret == "" {
		log.Println("WARN: JWT_SECRET not set — ห้ามใช้ใน production จริง")
	}
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGIN"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			cfg.AllowedOrigins = append(cfg.AllowedOrigins, o)
		}
	}
	return cfg
}
