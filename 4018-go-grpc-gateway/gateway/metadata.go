package gateway

import (
	"net/http"
	"strings"
	"unicode"

	"google.golang.org/grpc/metadata"
)

const (
	// httpHeaderPrefix marks HTTP headers that should be forwarded to gRPC metadata.
	httpHeaderPrefix = "x-"
	// grpcHeaderPrefix marks gRPC metadata that should be returned as HTTP headers.
	grpcHeaderPrefix = "grpc-"
	// grpcMetadataSuffix is the HTTP header suffix for forwarded gRPC metadata.
	grpcMetadataSuffix = ""
)

// metadataMaxSize caps the total size of outgoing/incoming metadata to avoid
// runaway header frames. The value mirrors typical gRPC (8 KiB).
const metadataMaxSize = 8 * 1024

// HTTPMetadataToGRPC extracts HTTP headers that begin with "x-" (case-insensitive)
// and converts them into gRPC metadata. Other headers are intentionally NOT
// forwarded to avoid leaking hop-by-hop metadata (e.g. Content-Length, Host).
func HTTPMetadataToGRPC(h http.Header) metadata.MD {
	md := metadata.MD{}
	total := 0
	for k, vs := range h {
		lk := strings.ToLower(k)
		if !strings.HasPrefix(lk, httpHeaderPrefix) {
			continue
		}
		for _, v := range vs {
			total += len(lk) + len(v) + 2
			if total > metadataMaxSize {
				return md
			}
			md.Append(lk, v)
		}
	}
	return md
}

// GRPCMetadataToHTTP converts gRPC metadata (incoming header / trailing header)
// into HTTP response headers. Each key is prefixed with "grpc-".
// Values with non-ASCII or control characters are percent-encoded per RFC 5987.
func GRPCMetadataToHTTP(md metadata.MD, h http.Header) {
	if h == nil {
		return
	}
	for k, vs := range md {
		hk := grpcHeaderPrefix + k
		for _, v := range vs {
			if needsEncoding(v) {
				v = "UTF-8''" + percentEncode(v)
			}
			h.Add(hk, v)
		}
	}
}

func needsEncoding(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || unicode.IsControl(r) {
			return true
		}
	}
	return false
}

// percentEncode applies RFC 5987 percent-encoding to a UTF-8 string.
func percentEncode(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, c := range []byte(s) {
		if isTokenChar(c) {
			b.WriteByte(c)
		} else {
			b.WriteByte('%')
			b.WriteByte("0123456789ABCDEF"[c>>4])
			b.WriteByte("0123456789ABCDEF"[c&0x0f])
		}
	}
	return b.String()
}

func isTokenChar(c byte) bool {
	return (c >= '0' && c <= '9') ||
		(c >= 'A' && c <= 'Z') ||
		(c >= 'a' && c <= 'z') ||
		c == '-' || c == '_' || c == '.' || c == '~'
}
