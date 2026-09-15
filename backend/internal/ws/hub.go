package ws

import (
	"encoding/json"
	"log"
	"sync"
)

// WSMessage คือ payload ที่ server ส่งหา client ผ่าน WebSocket
type WSMessage struct {
	Type string      `json:"type"` // task.new | task.update
	Task interface{} `json:"task"`
}

// Hub — broadcast ข้อความหา user (1 user ต่อหลาย connection)
type Hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*Client]struct{}
}

type Client struct {
	UserID int64
	send   chan []byte
}

func NewHub() *Hub {
	return &Hub{clients: map[int64]map[*Client]struct{}{}}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[c.UserID] == nil {
		h.clients[c.UserID] = map[*Client]struct{}{}
	}
	h.clients[c.UserID][c] = struct{}{}
	log.Printf("WS register user=%d (connections=%d)", c.UserID, len(h.clients[c.UserID]))
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set, ok := h.clients[c.UserID]; ok {
		if _, ok := set[c]; ok {
			delete(set, c)
			close(c.send)
		}
		if len(set) == 0 {
			delete(h.clients, c.UserID)
		}
	}
}

// SendToUser — ส่งหาทุก connection ของ user นั้น
func (h *Hub) SendToUser(userID int64, msg WSMessage) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		select {
		case c.send <- b:
		default:
			go h.Unregister(c)
		}
	}
}

// Broadcast — ส่งหาทุก connection ทุก user
func (h *Hub) Broadcast(msg WSMessage) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, clientSet := range h.clients {
		for c := range clientSet {
			select {
			case c.send <- b:
			default:
				go h.Unregister(c)
			}
		}
	}
}

func (c *Client) Send() chan<- []byte { return c.send }
