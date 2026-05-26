package server

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	pb "grpc-gateway-example/proto/echo"
)

type echoServer struct {
	pb.UnimplementedEchoServiceServer
	addr string
}

func (s *echoServer) Echo(ctx context.Context, req *pb.EchoRequest) (*pb.EchoResponse, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	log.Printf("[echo-server %s] Echo: message=%q md=%v", s.addr, req.Message, md)
	if req.Message == "" {
		return nil, status.Error(codes.InvalidArgument, "message must not be empty")
	}
	return &pb.EchoResponse{Message: fmt.Sprintf("echo(%s): %s", s.addr, req.Message), Seq: 1}, nil
}

func (s *echoServer) ServerStream(req *pb.EchoRequest, stream grpc.ServerStreamingServer[pb.EchoResponse]) error {
	log.Printf("[echo-server %s] ServerStream: message=%q", s.addr, req.Message)
	for i := int64(1); i <= 3; i++ {
		if err := stream.Send(&pb.EchoResponse{
			Message: fmt.Sprintf("stream(%s): %s #%d", s.addr, req.Message, i),
			Seq:     i,
		}); err != nil {
			return err
		}
		select {
		case <-time.After(100 * time.Millisecond):
		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
	return nil
}

func (s *echoServer) ClientStream(stream grpc.ClientStreamingServer[pb.EchoRequest, pb.EchoResponse]) error {
	log.Printf("[echo-server %s] ClientStream start", s.addr)
	var msgs []string
	for {
		req, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return err
		}
		msgs = append(msgs, req.Message)
	}
	return stream.SendAndClose(&pb.EchoResponse{
		Message: fmt.Sprintf("collected(%d): %v", len(msgs), msgs),
		Seq:     int64(len(msgs)),
	})
}

func (s *echoServer) BidiStream(stream grpc.BidiStreamingServer[pb.EchoRequest, pb.EchoResponse]) error {
	log.Printf("[echo-server %s] BidiStream start", s.addr)
	i := int64(0)
	for {
		req, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				return nil
			}
			return err
		}
		i++
		if err := stream.Send(&pb.EchoResponse{
			Message: fmt.Sprintf("bidi(%s): %s", s.addr, req.Message),
			Seq:     i,
		}); err != nil {
			return err
		}
	}
}

func RunEchoServer(addr string, flaky bool) (func(), error) {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}
	srv := grpc.NewServer()
	base := &echoServer{addr: addr}
	var impl pb.EchoServiceServer = base
	if flaky {
		impl = &flakyEchoServer{echoServer: base}
	}
	pb.RegisterEchoServiceServer(srv, impl)
	go func() {
		log.Printf("gRPC echo server listening on %s (flaky=%v)", addr, flaky)
		if err := srv.Serve(lis); err != nil {
			log.Printf("grpc server error: %v", err)
		}
	}()
	return func() { srv.GracefulStop() }, nil
}

type flakyEchoServer struct {
	*echoServer
}

func (f *flakyEchoServer) Echo(ctx context.Context, req *pb.EchoRequest) (*pb.EchoResponse, error) {
	if rand.Intn(100) < 70 {
		return nil, status.Error(codes.Unavailable, "backend is flaky")
	}
	return f.echoServer.Echo(ctx, req)
}

func (f *flakyEchoServer) ServerStream(req *pb.EchoRequest, stream grpc.ServerStreamingServer[pb.EchoResponse]) error {
	if rand.Intn(100) < 70 {
		return status.Error(codes.Unavailable, "backend is flaky")
	}
	return f.echoServer.ServerStream(req, stream)
}

func (f *flakyEchoServer) ClientStream(stream grpc.ClientStreamingServer[pb.EchoRequest, pb.EchoResponse]) error {
	if rand.Intn(100) < 70 {
		return status.Error(codes.Unavailable, "backend is flaky")
	}
	return f.echoServer.ClientStream(stream)
}

func (f *flakyEchoServer) BidiStream(stream grpc.BidiStreamingServer[pb.EchoRequest, pb.EchoResponse]) error {
	if rand.Intn(100) < 70 {
		return status.Error(codes.Unavailable, "backend is flaky")
	}
	return f.echoServer.BidiStream(stream)
}
