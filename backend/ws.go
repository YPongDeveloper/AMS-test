package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // native app / curl
		}
		return allowedOrigins[origin] || len(allowedOrigins) == 0
	},
}

func handleWS(h *hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := parseJWT(r.URL.Query().Get("token"))
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}
		c := &wsClient{userID: claims.UserID, send: make(chan []byte, 16)}
		h.register(c)

		// reader: รับ ping/pong + ปิดเมื่อ client หลุด
		go func() {
			defer func() {
				h.unregister(c)
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

		// writer: ส่ง ping ทุก 25 วิ + ส่งข้อความจาก hub
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case msg, ok := <-c.send:
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if !ok {
					conn.WriteMessage(websocket.CloseMessage, nil)
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
}
