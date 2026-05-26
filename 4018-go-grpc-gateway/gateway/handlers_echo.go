package gateway

import (
	"context"
	"io"
	"net/http"
	"strconv"

	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/proto"

	pb "grpc-gateway-example/proto/echo"
)

// EchoHandler is a small, hand-written wrapper that glues the generated
// `pb.EchoServiceClient` to the Gateway helpers. In a real project this file
// could also be generated from a .proto with `google.api.http` annotations.
type EchoHandler struct {
	*Gateway
	Client pb.EchoServiceClient
}

// Register mounts all EchoService routes on the given mux.
func (h *EchoHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/v1/echo", h.Echo)
	mux.HandleFunc("/v1/echo/stream", h.ServerStream)
	mux.HandleFunc("/v1/echo/collect", h.ClientStream)
	mux.HandleFunc("/v1/echo/bidi", h.BidiStream)
}

func (h *EchoHandler) ctx(r *http.Request) context.Context {
	return metadata.NewOutgoingContext(r.Context(), HTTPMetadataToGRPC(r.Header))
}

// Echo is the unary handler.
func (h *EchoHandler) Echo(w http.ResponseWriter, r *http.Request) {
	ctx := h.ctx(r)
	cb := h.breakerFor(pb.EchoService_Echo_FullMethodName)
	req := &pb.EchoRequest{}
	body := mustReadAll(r)
	if len(body) > 0 {
		if err := h.marshaler.Unmarshal(body, req); err != nil {
			h.writeJSON(w, http.StatusBadRequest, map[string]any{
				"code": http.StatusBadRequest, "message": "invalid JSON: " + err.Error(),
			})
			return
		}
	}
	result, err := cb.Execute(func() (any, error) {
		return h.Client.Echo(ctx, req)
	})
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	h.writeProto(w, result.(*pb.EchoResponse))
}

// ServerStream reads `message` and `count` from the query and streams responses.
func (h *EchoHandler) ServerStream(w http.ResponseWriter, r *http.Request) {
	ctx := h.ctx(r)
	if c := r.URL.Query().Get("count"); c != "" {
		if n, err := strconv.Atoi(c); err == nil && n > 0 {
			_ = n
		}
	}
	req := &pb.EchoRequest{Message: r.URL.Query().Get("message")}
	stream, err := h.Client.ServerStream(ctx, req)
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	h.DoServerStream(w, r,
		func() error { return nil },
		func() (proto.Message, error) { return stream.Recv() },
	)
}

// ClientStream accepts NDJSON from the body and sends each message to the stream.
func (h *EchoHandler) ClientStream(w http.ResponseWriter, r *http.Request) {
	ctx := h.ctx(r)
	stream, err := h.Client.ClientStream(ctx)
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	h.DoClientStream(w, r,
		func(m proto.Message) error { return stream.Send(m.(*pb.EchoRequest)) },
		func() (proto.Message, error) { return stream.CloseAndRecv() },
		func() proto.Message { return &pb.EchoRequest{} },
	)
}

// BidiStream accepts NDJSON request lines and returns NDJSON responses.
func (h *EchoHandler) BidiStream(w http.ResponseWriter, r *http.Request) {
	ctx := h.ctx(r)
	stream, err := h.Client.BidiStream(ctx)
	if err != nil {
		h.handleError(w, r, err)
		return
	}
	h.DoBidiStream(w, r,
		func(m proto.Message) error { return stream.Send(m.(*pb.EchoRequest)) },
		func() error { return stream.CloseSend() },
		func() (proto.Message, error) { return stream.Recv() },
		func() proto.Message { return &pb.EchoRequest{} },
	)
}

// handleError writes a proper HTTP error.
func (h *EchoHandler) handleError(w http.ResponseWriter, r *http.Request, err error) {
	h.writeGRPCError(w, r, err)
}

// mustReadAll reads the entire request body (with a 4 MiB cap) and returns it.
func mustReadAll(r *http.Request) []byte {
	const limit = 4 << 20
	b, _ := io.ReadAll(io.LimitReader(r.Body, limit))
	return b
}
