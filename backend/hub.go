package main

import (
	"encoding/json"
	"log"
	"sync"
)

// WSMessage คือ payload ที่ server ส่งหา client ผ่าน WebSocket
type WSMessage struct {
	Type string `json:"type"` // task.new | task.update
	Task *Task  `json:"task"`
}

// hub คุมการ broadcast ข้อความหา user แต่ละคน (1 user ต่อหลาย connection)
type hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*wsClient]struct{}
}

type wsClient struct {
	userID int64
	send   chan []byte
}

func newHub() *hub {
	return &hub{clients: map[int64]map[*wsClient]struct{}{}}
}

func (h *hub) register(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.userID] == nil {
		h.clients[c.userID] = map[*wsClient]struct{}{}
	}
	h.clients[c.userID][c] = struct{}{}
	log.Printf("WS register user=%d (connections=%d)", c.userID, len(h.clients[c.userID]))
}

func (h *hub) unregister(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set, ok := h.clients[c.userID]; ok {
		if _, ok := set[c]; ok {
			delete(set, c)
			close(c.send)
		}
		if len(set) == 0 {
			delete(h.clients, c.userID)
		}
	}
}

// sendToUser ส่งข้อความหาทุก connection ที่ login ด้วย userID นั้น
func (h *hub) sendToUser(userID int64, msg WSMessage) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		select {
		case c.send <- b:
		default: // channel เต็ม = client ค้าง ทิ้ง connection
			go func(c *wsClient) { h.unregister(c) }(c)
		}
	}
}
