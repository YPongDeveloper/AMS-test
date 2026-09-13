package ws

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// Identity — ข้อมูลที่ router ดึงจาก access token ก่อนอัปเกรด connection
type Identity struct {
	UserID int64
}

type TokenAuthFunc func(token string) (*Identity, error)

type Handler struct {
	hub  *Hub
	auth TokenAuthFunc
}

func NewHandler(hub *Hub, auth TokenAuthFunc) *Handler {
	return &Handler{hub: hub, auth: auth}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // CORS คุมที่ middleware
}

// Serve — GET /ws?token=<access_token>
func (h *Handler) Serve(w http.ResponseWriter, r *http.Request) {
	identity, err := h.auth(r.URL.Query().Get("token"))
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade:", err)
		return
	}
	client := &Client{UserID: identity.UserID, send: make(chan []byte, 16)}
	h.hub.Register(client)

	// reader: ตรวจหลุด + รับ pong
	go func() {
		defer func() {
			h.hub.Unregister(client)
			conn.Close()
		}()
		conn.SetReadLimit(1024)
		conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(90 * time.Second))
			return nil
		})
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	// writer: ping ทุก 25 วิ + ส่งข้อความจาก hub
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case msg, ok := <-client.send:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
