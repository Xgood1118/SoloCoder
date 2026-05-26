package gateway

import (
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// Marshaler configures the JSON <-> proto.Message conversion used by the gateway.
// Using protojson (aka JSONpb) gives stable, deterministic mapping including
// special proto types (Duration, Timestamp, WKTs, Any, …).
type Marshaler struct {
	MarshalOpts   protojson.MarshalOptions
	UnmarshalOpts protojson.UnmarshalOptions
}

// DefaultMarshaler returns a Marshaler configured for browser-friendly output:
// - emits enum values as strings
// - uses camelCase JSON names
// - omits zero values
func DefaultMarshaler() Marshaler {
	return Marshaler{
		MarshalOpts: protojson.MarshalOptions{
			UseEnumNumbers:  false,
			EmitUnpopulated: false,
		},
		UnmarshalOpts: protojson.UnmarshalOptions{
			DiscardUnknown: true,
		},
	}
}

// Marshal serializes a proto.Message into JSON bytes.
func (m Marshaler) Marshal(msg proto.Message) ([]byte, error) {
	return m.MarshalOpts.Marshal(msg)
}

// Unmarshal reads JSON bytes into a proto.Message.
func (m Marshaler) Unmarshal(data []byte, msg proto.Message) error {
	return m.UnmarshalOpts.Unmarshal(data, msg)
}
