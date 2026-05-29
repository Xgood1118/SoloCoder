package converter

import (
	"encoding/json"
	"fmt"

	"github.com/jmespath/go-jmespath"
)

type Converter struct {
	expr *jmespath.JMESPath
}

type Envelope struct {
	Topic   string          `json:"topic"`
	QoS     byte            `json:"qos"`
	Retain  bool            `json:"retain"`
	Payload json.RawMessage `json:"payload"`
}

func New(template string) (*Converter, error) {
	c := &Converter{}
	if template != "" {
		expr, err := jmespath.Compile(template)
		if err != nil {
			return nil, fmt.Errorf("compile jmespath template: %w", err)
		}
		c.expr = expr
	}
	return c, nil
}

func (c *Converter) BuildBody(topic string, qos byte, retain bool, payload []byte) ([]byte, error) {
	var parsed interface{}
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &parsed); err != nil {
			parsed = string(payload)
		}
	}
	env := Envelope{
		Topic:   topic,
		QoS:     qos,
		Retain:  retain,
		Payload: payload,
	}

	if c.expr != nil {
		var data interface{} = map[string]interface{}{
			"topic":  env.Topic,
			"qos":    env.QoS,
			"retain": env.Retain,
			"payload": parsed,
		}
		result, err := c.expr.Search(data)
		if err != nil {
			return nil, fmt.Errorf("jmespath search: %w", err)
		}
		return json.Marshal(result)
	}

	out := map[string]interface{}{
		"topic":  env.Topic,
		"qos":    env.QoS,
		"retain": env.Retain,
		"payload": parsed,
	}
	return json.Marshal(out)
}
