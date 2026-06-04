package hub

import (
	"chatroom/model"
	"chatroom/service"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   string
	Username string
}

type Hub struct {
	mu             sync.RWMutex
	clients        map[*Client]bool
	chatroomClients map[string]map[*Client]bool
	ChatroomSvc    *service.ChatroomService
	MemberSvc      *service.MemberService
	MessageSvc     *service.MessageService
	StatusSvc      *service.StatusService
	Register       chan *Client
	Unregister     chan *Client
}

func NewHub(cs *service.ChatroomService, ms *service.MemberService, msgs *service.MessageService, ss *service.StatusService) *Hub {
	return &Hub{
		clients:         make(map[*Client]bool),
		chatroomClients: make(map[string]map[*Client]bool),
		ChatroomSvc:     cs,
		MemberSvc:       ms,
		MessageSvc:      msgs,
		StatusSvc:       ss,
		Register:        make(chan *Client),
		Unregister:      make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				for crID, clients := range h.chatroomClients {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.chatroomClients, crID)
					}
				}
				close(client.Send)
			}
			h.mu.Unlock()
			h.StatusSvc.SetOffline(client.UserID)
		}
	}
}

func (h *Hub) Subscribe(chatroomID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.chatroomClients[chatroomID] == nil {
		h.chatroomClients[chatroomID] = make(map[*Client]bool)
	}
	h.chatroomClients[chatroomID][client] = true
}

func (h *Hub) Unsubscribe(chatroomID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.chatroomClients[chatroomID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.chatroomClients, chatroomID)
		}
	}
}

func (h *Hub) BroadcastToChatroom(chatroomID string, msg *model.Message) {
	data, err := json.Marshal(map[string]interface{}{
		"type":    "message",
		"payload": msg,
	})
	if err != nil {
		log.Printf("marshal error: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.chatroomClients[chatroomID]
	if !ok {
		return
	}
	for client := range clients {
		select {
		case client.Send <- data:
		default:
			go func(c *Client) {
				h.Unregister <- c
			}(client)
		}
	}
}

func (h *Hub) SendToUser(userID string, msgType string, payload interface{}) {
	data, err := json.Marshal(map[string]interface{}{
		"type":    msgType,
		"payload": payload,
	})
	if err != nil {
		log.Printf("marshal error: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		if client.UserID == userID {
			select {
			case client.Send <- data:
			default:
			}
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		var req WSRequest
		if err := json.Unmarshal(message, &req); err != nil {
			continue
		}
		c.handleRequest(req)
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()
	for {
		msg, ok := <-c.Send
		if !ok {
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}
		if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

type WSRequest struct {
	Action     string          `json:"action"`
	ChatroomID string          `json:"chatroom_id,omitempty"`
	Content    string          `json:"content,omitempty"`
	Type       model.MessageType `json:"type,omitempty"`
	MentionIDs []string        `json:"mention_ids,omitempty"`
	QuoteID    *string         `json:"quote_id,omitempty"`
	MessageID  string          `json:"message_id,omitempty"`
	Emoji      string          `json:"emoji,omitempty"`
}

func (c *Client) handleRequest(req WSRequest) {
	switch req.Action {
	case "subscribe":
		c.handleSubscribe(req)
	case "unsubscribe":
		c.handleUnsubscribe(req)
	case "send_message":
		c.handleSendMessage(req)
	case "add_reaction":
		c.handleAddReaction(req)
	case "remove_reaction":
		c.handleRemoveReaction(req)
	}
}

func (c *Client) handleSubscribe(req WSRequest) {
	member, ok := c.Hub.ChatroomSvc.GetMember(req.ChatroomID, c.UserID)
	if !ok {
		return
	}
	if member == nil {
		return
	}
	c.Hub.Subscribe(req.ChatroomID, c)

	sysMsg, _ := c.Hub.MessageSvc.SendSystem(req.ChatroomID, c.Username+" 加入了聊天室")
	if sysMsg != nil {
		c.Hub.BroadcastToChatroom(req.ChatroomID, sysMsg)
	}
}

func (c *Client) handleUnsubscribe(req WSRequest) {
	c.Hub.Unsubscribe(req.ChatroomID, c)

	sysMsg, _ := c.Hub.MessageSvc.SendSystem(req.ChatroomID, c.Username+" 离开了聊天室")
	if sysMsg != nil {
		c.Hub.BroadcastToChatroom(req.ChatroomID, sysMsg)
	}
}

func (c *Client) handleSendMessage(req WSRequest) {
	msg, err := c.Hub.MessageSvc.Send(service.SendMessageReq{
		ChatroomID: req.ChatroomID,
		UserID:     c.UserID,
		Username:   c.Username,
		Type:       req.Type,
		Content:    req.Content,
		MentionIDs: req.MentionIDs,
		QuoteID:    req.QuoteID,
	})
	if err != nil {
		c.Hub.SendToUser(c.UserID, "error", map[string]string{"message": err.Error()})
		return
	}
	c.Hub.BroadcastToChatroom(req.ChatroomID, msg)

	if len(req.MentionIDs) > 0 {
		for _, uid := range req.MentionIDs {
			c.Hub.SendToUser(uid, "mention", map[string]interface{}{
				"chatroom_id": req.ChatroomID,
				"message_id":  msg.ID,
				"from_user":   c.Username,
				"content":     req.Content,
			})
		}
	}
}

func (c *Client) handleAddReaction(req WSRequest) {
	msg, err := c.Hub.MessageSvc.AddReaction(req.ChatroomID, req.MessageID, c.UserID, req.Emoji)
	if err != nil {
		c.Hub.SendToUser(c.UserID, "error", map[string]string{"message": err.Error()})
		return
	}
	c.Hub.BroadcastToChatroom(req.ChatroomID, msg)
}

func (c *Client) handleRemoveReaction(req WSRequest) {
	err := c.Hub.MessageSvc.RemoveReaction(req.ChatroomID, req.MessageID, c.UserID, req.Emoji)
	if err != nil {
		c.Hub.SendToUser(c.UserID, "error", map[string]string{"message": err.Error()})
		return
	}
	msg, _ := c.Hub.MessageSvc.GetMessage(req.ChatroomID, req.MessageID)
	if msg != nil {
		c.Hub.BroadcastToChatroom(req.ChatroomID, msg)
	}
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	username := r.URL.Query().Get("username")
	if userID == "" || username == "" {
		http.Error(w, "user_id and username required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}

	hub.StatusSvc.EnsureUser(userID, username)
	hub.StatusSvc.SetOnline(userID)

	client := &Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		UserID:   userID,
		Username: username,
	}
	hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}
