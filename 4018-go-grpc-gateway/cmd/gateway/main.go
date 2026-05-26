package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"grpc-gateway-example/gateway"
	pb "grpc-gateway-example/proto/echo"
	"grpc-gateway-example/server"
)

func main() {
	var (
		httpAddr  = flag.String("http", ":8100", "HTTP gateway listen address")
		grpcAddr  = flag.String("grpc", ":9090", "gRPC backend listen address")
		flaky     = flag.Bool("flaky", false, "make the gRPC backend randomly fail to demo circuit breaker")
		dialAddr  = flag.String("dial", "127.0.0.1:9090", "gRPC backend dial address (gateway -> backend)")
	)
	flag.Parse()

	stop, err := server.RunEchoServer(*grpcAddr, *flaky)
	if err != nil {
		log.Fatalf("start backend: %v", err)
	}
	defer stop()

	// Give the backend a moment to start accepting connections.
	time.Sleep(200 * time.Millisecond)

	cc, err := grpc.Dial(
		*dialAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("dial backend: %v", err)
	}
	defer cc.Close()

	gw := gateway.New(cc)
	echoH := &gateway.EchoHandler{Gateway: gw, Client: pb.NewEchoServiceClient(cc)}

	mux := http.NewServeMux()
	echoH.Register(mux)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	srv := &http.Server{
		Addr:         *httpAddr,
		Handler:      logMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}
	log.Printf("gateway listening on http://%s -> gRPC %s", *httpAddr, *dialAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("http server: %v", err)
	}
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("[http] %s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
		log.Printf("[http] %s %s finished in %s", r.Method, r.URL.Path, time.Since(start))
	})
}
