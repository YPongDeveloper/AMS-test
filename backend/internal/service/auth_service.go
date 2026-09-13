package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"ams-backend/internal/model"
	"ams-backend/internal/repository"
)

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 30 * 24 * time.Hour
)

// Claims ที่ฝังใน Access Token — handler/middleware ดึง uid/role จากตรงนี้เสมอ
type Claims struct {
	UserID   int64  `json:"uid"`
	PublicID string `json:"pub"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

var ErrInvalidToken = errors.New("invalid or expired token")

type AuthService struct {
	users         *repository.UserRepository
	refreshTokens *repository.RefreshTokenRepository
	secret        []byte
	lineChannelID string
}

func NewAuthService(users *repository.UserRepository, refresh *repository.RefreshTokenRepository, secret, lineChannelID string) *AuthService {
	if strings.TrimSpace(secret) == "" {
		log.Println("WARN: JWT_SECRET not set — สุ่มชั่วคราว (token จะใช้ไม่ได้เมื่อ restart)")
		secret = fmt.Sprintf("dev-secret-%d", time.Now().UnixNano())
	}
	return &AuthService{
		users:         users,
		refreshTokens: refresh,
		secret:        []byte(secret),
		lineChannelID: lineChannelID,
	}
}

// ---- access token ----

func (s *AuthService) signAccessToken(u *model.User) (string, error) {
	c := Claims{
		UserID:   u.ID,
		PublicID: u.PublicID,
		Role:     u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "ams-backend",
			Subject:   u.PublicID,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.secret)
}

// ParseAccessToken — ใช้ทั้ง middleware และ ws handler
func ParseAccessToken(secret string, tokenStr string) (*Claims, error) {
	c := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}
	return c, nil
}

// ---- refresh token ----

func newRefreshToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

func (s *AuthService) issueRefreshToken(ctx context.Context, userID int64) (string, error) {
	rt := newRefreshToken()
	if err := s.refreshTokens.Create(ctx, userID, hashToken(rt), time.Now().Add(RefreshTokenTTL)); err != nil {
		return "", err
	}
	return rt, nil
}

// ---- flows ----

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

// LoginWithLineIDToken — ตรวจ ID Token กับ LINE → upsert user → ออก AT+RT
func (s *AuthService) LoginWithLineIDToken(ctx context.Context, idToken string) (*model.User, *TokenPair, error) {
	lv, err := s.verifyWithLine(ctx, idToken)
	if err != nil {
		return nil, nil, err
	}

	name := lv.Name
	if name == "" {
		name = "ผู้ใช้ LINE"
	}
	var pic *string
	if lv.Picture != "" {
		pic = &lv.Picture
	}

	user, err := s.users.FindByLineUserID(ctx, lv.Sub)
	if err != nil {
		if !repository.IsNotFound(err) {
			return nil, nil, fmt.Errorf("db: %w", err)
		}
		// ผู้ใช้ใหม่: คนแรกของระบบ = หัวหน้างาน
		role := model.RoleSubordinate
		if n, _ := s.users.CountAll(ctx); n == 0 {
			role = model.RoleSupervisor
		}
		user, err = s.users.Create(ctx, lv.Sub, name, pic, role)
		if err != nil {
			return nil, nil, fmt.Errorf("create user: %w", err)
		}
		log.Printf("new user public=%s role=%s", user.PublicID, user.Role)
	} else {
		if err := s.users.UpdateProfile(ctx, user.ID, name, pic); err != nil {
			return nil, nil, err
		}
	}

	at, err := s.signAccessToken(user)
	if err != nil {
		return nil, nil, err
	}
	rt, err := s.issueRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, nil, err
	}
	return user, &TokenPair{
		AccessToken:  at,
		RefreshToken: rt,
		TokenType:    "Bearer",
		ExpiresIn:    int(AccessTokenTTL.Seconds()),
	}, nil
}

// Refresh — ตรวจ RT → rotate (revoke เก่า ออกคู่ใหม่)
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.User, *TokenPair, error) {
	userID, err := s.refreshTokens.FindValid(ctx, hashToken(refreshToken))
	if err != nil {
		return nil, nil, ErrInvalidToken
	}
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, nil, ErrInvalidToken
	}
	if err := s.refreshTokens.Revoke(ctx, hashToken(refreshToken)); err != nil {
		return nil, nil, err
	}
	at, err := s.signAccessToken(u)
	if err != nil {
		return nil, nil, err
	}
	newRT, err := s.issueRefreshToken(ctx, u.ID)
	if err != nil {
		return nil, nil, err
	}
	return u, &TokenPair{AccessToken: at, RefreshToken: newRT, TokenType: "Bearer", ExpiresIn: int(AccessTokenTTL.Seconds())}, nil
}

// Logout — revoke refresh token
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.refreshTokens.Revoke(ctx, hashToken(refreshToken))
}

// Me — โปรไฟล์ผู้ใช้จาก internal id (มาจาก claims ของ token เสมอ)
func (s *AuthService) Me(ctx context.Context, userID int64) (*model.User, error) {
	return s.users.FindByID(ctx, userID)
}

// LoginWithPassword — เข้าสู่ระบบด้วย username/password (บัญชีที่ seed: admin/leader/normal)
func (s *AuthService) LoginWithPassword(ctx context.Context, username, password string) (*model.User, *TokenPair, error) {
	if username == "" || password == "" {
		return nil, nil, errors.New("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน")
	}
	u, err := s.users.FindByUsername(ctx, username)
	if err != nil {
		return nil, nil, errors.New("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
	}
	if u.PasswordHash == "" || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return nil, nil, errors.New("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
	}
	at, err := s.signAccessToken(u)
	if err != nil {
		return nil, nil, err
	}
	rt, err := s.issueRefreshToken(ctx, u.ID)
	if err != nil {
		return nil, nil, err
	}
	return u, &TokenPair{
		AccessToken:  at,
		RefreshToken: rt,
		TokenType:    "Bearer",
		ExpiresIn:    int(AccessTokenTTL.Seconds()),
	}, nil
}

type lineVerifyResp struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (s *AuthService) verifyWithLine(ctx context.Context, idToken string) (*lineVerifyResp, error) {
	form := url.Values{"id_token": {idToken}}
	if s.lineChannelID != "" {
		form.Set("client_id", s.lineChannelID)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.line.me/oauth2/v2.1/verify", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("เชื่อมต่อ LINE ไม่สำเร็จ: %w", err)
	}
	defer resp.Body.Close()
	var lv lineVerifyResp
	if err := json.NewDecoder(resp.Body).Decode(&lv); err != nil || resp.StatusCode != http.StatusOK || lv.Sub == "" {
		return nil, ErrInvalidToken
	}
	return &lv, nil
}
