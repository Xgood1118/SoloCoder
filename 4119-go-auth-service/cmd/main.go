package main

import (
	"log"

	"auth-service/internal/config"
	"auth-service/internal/server"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	s := server.New()
	if err := s.Run(); err != nil {
		log.Fatalf("server run failed: %v", err)
	}
}
