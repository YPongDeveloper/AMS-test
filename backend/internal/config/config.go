package config

import (
	"log"
	"os"
	"strconv"
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
	DBMaxConns             int32
	DBMinConns             int32
	RateLimitPerMin        int
	RateLimitBurst         int
	MaxBodySizeBytes       int64
}

func getEnvInt(key string, def int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil && i > 0 {
			return i
		}
	}
	return def
}

func Load() Config {
	cfg := Config{
		Port:                   os.Getenv("PORT"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		JWTSecret:              os.Getenv("JWT_SECRET"),
		LineChannelID:          os.Getenv("LINE_CHANNEL_ID"),
		LineChannelAccessToken: os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"),
		LiffID:                 os.Getenv("LIFF_ID"),
		DBMaxConns:             int32(getEnvInt("DB_MAX_CONNS", 10)),
		DBMinConns:             int32(getEnvInt("DB_MIN_CONNS", 2)),
		RateLimitPerMin:        getEnvInt("RATE_LIMIT_PER_MIN", 240),
		RateLimitBurst:         getEnvInt("RATE_LIMIT_BURST", 60),
		MaxBodySizeBytes:       int64(getEnvInt("MAX_BODY_SIZE_BYTES", 10*1024*1024)), // 10MB
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
