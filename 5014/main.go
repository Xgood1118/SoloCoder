package main

import (
	"chatroom/handler"
	"chatroom/hub"
	"chatroom/service"
	"chatroom/store"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	s := store.New()

	chatroomSvc := service.NewChatroomService(s)
	memberSvc := service.NewMemberService(s)
	messageSvc := service.NewMessageService(s)
	statusSvc := service.NewStatusService(s, 10*time.Minute)

	h := hub.NewHub(chatroomSvc, memberSvc, messageSvc, statusSvc)
	go h.Run()

	chatroomH := handler.NewChatroomHandler(chatroomSvc, memberSvc, messageSvc, statusSvc, h)
	memberH := handler.NewMemberHandler(memberSvc, messageSvc, h)
	messageH := handler.NewMessageHandler(messageSvc, h)
	statusH := handler.NewStatusHandler(statusSvc)

	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/chatrooms", chatroomH.Create)
	mux.HandleFunc("GET /api/chatrooms/{id}", chatroomH.Get)
	mux.HandleFunc("PUT /api/chatrooms/{id}", chatroomH.Update)
	mux.HandleFunc("POST /api/chatrooms/{id}/shutdown", chatroomH.Shutdown)

	mux.HandleFunc("POST /api/chatrooms/{id}/members", memberH.Join)
	mux.HandleFunc("DELETE /api/chatrooms/{id}/members", memberH.Leave)
	mux.HandleFunc("POST /api/chatrooms/{id}/members/{user_id}/kick", memberH.Kick)
	mux.HandleFunc("POST /api/chatrooms/{id}/members/{user_id}/mute", memberH.Mute)
	mux.HandleFunc("DELETE /api/chatrooms/{id}/members/{user_id}/mute", memberH.Unmute)
	mux.HandleFunc("GET /api/chatrooms/{id}/members", memberH.ListMembers)
	mux.HandleFunc("POST /api/chatrooms/{id}/requests/{request_id}/approve", memberH.ApproveRequest)
	mux.HandleFunc("POST /api/chatrooms/{id}/requests/{request_id}/reject", memberH.RejectRequest)
	mux.HandleFunc("GET /api/chatrooms/{id}/requests", memberH.ListPendingRequests)

	mux.HandleFunc("POST /api/chatrooms/{id}/messages", messageH.Send)
	mux.HandleFunc("GET /api/chatrooms/{id}/messages", messageH.History)
	mux.HandleFunc("POST /api/chatrooms/{id}/messages/{message_id}/reactions", messageH.AddReaction)
	mux.HandleFunc("DELETE /api/chatrooms/{id}/messages/{message_id}/reactions", messageH.RemoveReaction)

	mux.HandleFunc("POST /api/users", statusH.Register)
	mux.HandleFunc("PUT /api/users/{user_id}/status", statusH.SetStatus)
	mux.HandleFunc("GET /api/users/{user_id}", statusH.GetUser)
	mux.HandleFunc("GET /api/users/{user_id}/chatrooms", statusH.GetUserChatrooms)

	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWS(h, w, r)
	})

	addr := ":8080"
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("chatroom server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server forced shutdown: %v", err)
	}
	log.Println("server exited")
}
