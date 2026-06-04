package main

import (
	"approval-flow/internal/api"
	"approval-flow/internal/condition"
	"approval-flow/internal/engine"
	"approval-flow/internal/notification"
	"approval-flow/internal/store"
	"log"
	"time"
)

func main() {
	s := store.NewInMemoryStore()
	ce := condition.NewEngine()
	ns := notification.NewNotificationService()
	e := engine.NewEngine(s, ce, ns)

	e.StartTimeoutChecker(30 * time.Second)
	defer e.StopTimeoutChecker()

	h := api.NewHandler(e, ns)

	log.Println("Approval Flow Engine starting on :8181")
	if err := api.StartServer(":8181", h); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
