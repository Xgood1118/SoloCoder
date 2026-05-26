package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/sony/gobreaker"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

// FallbackFunc produces a fallback JSON-serializable response when the upstream
// gRPC service is unavailable (circuit breaker open / invocation failed).
type FallbackFunc func(r *http.Request, err error) any

// Gateway is a tiny gRPC-gateway that turns HTTP handlers into gRPC calls.
//
// It is deliberately NOT a full code-generator; instead it exposes small helpers
// that can be composed either by hand or by a code-generated wrapper that the
// user owns (see `gateway/handlers_echo.go` for an example).
type Gateway struct {
	cc         *grpc.ClientConn
	marshaler  Marshaler
	breakers   map[string]*gobreaker.CircuitBreaker
	breakerCfg gobreaker.Settings
	fallback   FallbackFunc
}

// Option customizes the gateway.
type Option func(*Gateway)

// WithFallback sets the fallback response generator for open-circuit / failed calls.
func WithFallback(fn FallbackFunc) Option {
	return func(g *Gateway) { g.fallback = fn }
}

// WithCircuitBreakerConfig customizes the per-method circuit breaker config.
func WithCircuitBreakerConfig(cfg gobreaker.Settings) Option {
	return func(g *Gateway) { g.breakerCfg = cfg }
}

// New creates a Gateway wrapping an existing gRPC ClientConn.
func New(cc *grpc.ClientConn, opts ...Option) *Gateway {
	g := &Gateway{
		cc:        cc,
		marshaler: DefaultMarshaler(),
		breakers:  map[string]*gobreaker.CircuitBreaker{},
		fallback: DefaultFallback,
		breakerCfg: gobreaker.Settings{
			Name:        "grpc-gateway",
			MaxRequests: 3,
			Interval:    10 * time.Second,
			Timeout:     30 * time.Second,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= 5
			},
			OnStateChange: func(name string, from, to gobreaker.State) {
				log.Printf("[gateway] breaker %s: %s -> %s", name, from, to)
			},
		},
	}
	for _, o := range opts {
		o(g)
	}
	return g
}

// DefaultFallback returns a friendly JSON body explaining the service is unavailable.
func DefaultFallback(_ *http.Request, err error) any {
	code := http.StatusServiceUnavailable
	msg := "upstream service unavailable"
	if err != nil {
		msg = err.Error()
	}
	return map[string]any{
		"code":    code,
		"message": msg,
		"fallback": true,
	}
}

// CC exposes the underlying gRPC client connection.
func (g *Gateway) CC() *grpc.ClientConn { return g.cc }

// Marshaler exposes the JSON/proto converter for custom handlers.
func (g *Gateway) Marshaler() Marshaler { return g.marshaler }

// breakerFor returns (lazily creating) a circuit breaker keyed by fullMethod.
func (g *Gateway) breakerFor(fullMethod string) *gobreaker.CircuitBreaker {
	if cb, ok := g.breakers[fullMethod]; ok {
		return cb
	}
	cfg := g.breakerCfg
	cfg.Name = fullMethod
	cb := gobreaker.NewCircuitBreaker(cfg)
	g.breakers[fullMethod] = cb
	return cb
}

// writeJSON writes v as JSON to w with the given HTTP status.
func (g *Gateway) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeProto writes a proto.Message using the gateway's JSON marshaler.
func (g *Gateway) writeProto(w http.ResponseWriter, msg proto.Message) {
	out, err := g.marshaler.Marshal(msg)
	if err != nil {
		g.writeJSON(w, http.StatusInternalServerError, map[string]any{
			"code":    http.StatusInternalServerError,
			"message": "marshal response: " + err.Error(),
		})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out)
}

// writeGRPCError converts a gRPC error into the proper HTTP response, including
// trailing metadata forwarded as grpc-* headers.
func (g *Gateway) writeGRPCError(w http.ResponseWriter, r *http.Request, err error) {
	st := status.Convert(err)
	// forward trailer metadata as grpc-* response headers
	if trailer := extractTrailer(err); trailer != nil {
		GRPCMetadataToHTTP(trailer, w.Header())
	}
	body := ErrBody(st)
	g.writeJSON(w, GRPCCodeToHTTP(st.Code()), body)
}

// extractTrailer walks the error chain looking for a trailing metadata set by gRPC.
func extractTrailer(err error) metadata.MD {
	type trailerer interface{ Trailer() metadata.MD }
	var t trailerer
	if errors.As(err, &t) {
		return t.Trailer()
	}
	return nil
}

// DoUnary executes a unary gRPC call, with JSON request/response conversion
// and circuit-breaker + fallback protection. It reads the HTTP request body,
// unmarshals it into req, invokes the gRPC method, and marshals the response.
func (g *Gateway) DoUnary(
	w http.ResponseWriter,
	r *http.Request,
	fullMethod string,
	req proto.Message,
	resp proto.Message,
) bool {
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	ctx = metadata.NewOutgoingContext(ctx, HTTPMetadataToGRPC(r.Header))

	body := make([]byte, 0, 1<<16)
	buf := make([]byte, 4096)
	for {
		n, err := r.Body.Read(buf)
		if n > 0 {
			body = append(body, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	if len(body) > 0 {
		if err := g.marshaler.Unmarshal(body, req); err != nil {
			g.writeJSON(w, http.StatusBadRequest, map[string]any{
				"code":    http.StatusBadRequest,
				"message": "invalid JSON: " + err.Error(),
			})
			return false
		}
	}

	cb := g.breakerFor(fullMethod)
	_, err := cb.Execute(func() (any, error) {
		return nil, g.cc.Invoke(ctx, fullMethod, req, resp)
	})
	if err != nil {
		if errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests) {
			g.writeJSON(w, http.StatusServiceUnavailable, g.fallback(r, err))
			return false
		}
		g.writeGRPCError(w, r, err)
		return false
	}
	out, jerr := g.marshaler.Marshal(resp)
	if jerr != nil {
		g.writeJSON(w, http.StatusInternalServerError, map[string]any{
			"code":    http.StatusInternalServerError,
			"message": "marshal response: " + jerr.Error(),
		})
		return false
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out)
	return true
}

// DoServerStream executes a server-streaming RPC and writes each response as a
// chunk-encoded NDJSON (newline-delimited JSON) payload.
// sendReq is called once to send the initial request on the stream.
//
// The recv callback is called repeatedly to drain the server-stream until EOF.
func (g *Gateway) DoServerStream(
	w http.ResponseWriter,
	r *http.Request,
	sendReq func() error,
	recv func() (proto.Message, error),
) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		g.writeJSON(w, http.StatusInternalServerError, map[string]any{
			"code":    http.StatusInternalServerError,
			"message": "streaming not supported",
		})
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Transfer-Encoding", "chunked")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	if err := sendReq(); err != nil {
		_, _ = fmt.Fprintf(w, "{\"error\":%q}\n", err.Error())
		flusher.Flush()
		return
	}

	for {
		msg, err := recv()
		if err != nil {
			if isStreamEOF(err) {
				return
			}
			st := status.Convert(err)
			_, _ = fmt.Fprintf(w, "{\"error\":{\"code\":%d,\"message\":%q}}\n",
				int32(st.Code()), st.Message())
			flusher.Flush()
			return
		}
		b, jerr := g.marshaler.Marshal(msg)
		if jerr != nil {
			_, _ = fmt.Fprintf(w, "{\"error\":%q}\n", jerr.Error())
			flusher.Flush()
			return
		}
		_, _ = w.Write(b)
		_, _ = w.Write([]byte("\n"))
		flusher.Flush()
	}
}

// DoClientStream accepts NDJSON from the HTTP body, decodes each line as a
// proto.Message, and sends it to a client-streaming RPC. When the body ends,
// it closes the stream and writes the single response.
func (g *Gateway) DoClientStream(
	w http.ResponseWriter,
	r *http.Request,
	send func(proto.Message) error,
	closeAndRecv func() (proto.Message, error),
	newReq func() proto.Message,
) {
	dec := json.NewDecoder(r.Body)
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			if isStreamEOF(err) {
				break
			}
			g.writeJSON(w, http.StatusBadRequest, map[string]any{
				"code":    http.StatusBadRequest,
				"message": "decode request: " + err.Error(),
			})
			return
		}
		req := newReq()
		if err := g.marshaler.Unmarshal(raw, req); err != nil {
			g.writeJSON(w, http.StatusBadRequest, map[string]any{
				"code":    http.StatusBadRequest,
				"message": "invalid JSON: " + err.Error(),
			})
			return
		}
		if err := send(req); err != nil {
			g.writeGRPCError(w, r, err)
			return
		}
	}
	resp, err := closeAndRecv()
	if err != nil {
		g.writeGRPCError(w, r, err)
		return
	}
	out, jerr := g.marshaler.Marshal(resp)
	if jerr != nil {
		g.writeJSON(w, http.StatusInternalServerError, map[string]any{
			"code":    http.StatusInternalServerError,
			"message": "marshal response: " + jerr.Error(),
		})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out)
}

// DoBidiStream accepts NDJSON request lines and returns NDJSON responses.
// Both directions are streamed concurrently; the HTTP response starts flushing
// as soon as the first message is received from upstream.
func (g *Gateway) DoBidiStream(
	w http.ResponseWriter,
	r *http.Request,
	send func(proto.Message) error,
	closeSend func() error,
	recv func() (proto.Message, error),
	newReq func() proto.Message,
) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		g.writeJSON(w, http.StatusInternalServerError, map[string]any{
			"code":    http.StatusInternalServerError,
			"message": "streaming not supported",
		})
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Transfer-Encoding", "chunked")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	sendDone := make(chan struct{})
	go func() {
		defer close(sendDone)
		dec := json.NewDecoder(r.Body)
		for {
			var raw json.RawMessage
			if err := dec.Decode(&raw); err != nil {
				return
			}
			req := newReq()
			if err := g.marshaler.Unmarshal(raw, req); err != nil {
				return
			}
			if err := send(req); err != nil {
				return
			}
		}
	}()

	go func() {
		<-sendDone
		_ = closeSend()
	}()

	for {
		msg, err := recv()
		if err != nil {
			if isStreamEOF(err) {
				return
			}
			st := status.Convert(err)
			_, _ = fmt.Fprintf(w, "{\"error\":{\"code\":%d,\"message\":%q}}\n",
				int32(st.Code()), st.Message())
			flusher.Flush()
			return
		}
		b, jerr := g.marshaler.Marshal(msg)
		if jerr != nil {
			_, _ = fmt.Fprintf(w, "{\"error\":%q}\n", jerr.Error())
			flusher.Flush()
			return
		}
		_, _ = w.Write(b)
		_, _ = w.Write([]byte("\n"))
		flusher.Flush()
	}
}

func isStreamEOF(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return msg == "EOF" ||
		msg == "rpc error: code = Canceled desc = context canceled" ||
		errors.Is(err, context.Canceled)
}
