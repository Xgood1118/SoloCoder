package mqttclient

import (
	"log"
	"regexp"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"mqtt-bridge/config"
)

type MessageHandler func(topic string, qos byte, retain bool, payload []byte)

type Client struct {
	inner mqtt.Client
	cfg   config.MQTTConfig
}

func New(cfg config.MQTTConfig) *Client {
	opts := mqtt.NewClientOptions().
		AddBroker(cfg.Broker).
		SetClientID(cfg.ClientID).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(2 * time.Second).
		SetMaxReconnectInterval(30 * time.Second).
		SetCleanSession(true).
		SetKeepAlive(30 * time.Second).
		SetOnConnectHandler(func(c mqtt.Client) {
			log.Printf("[mqtt] connected to %s as %s", cfg.Broker, cfg.ClientID)
		}).
		SetConnectionLostHandler(func(_ mqtt.Client, err error) {
			log.Printf("[mqtt] connection lost: %v", err)
		})

	if cfg.Username != "" {
		opts.SetUsername(cfg.Username)
	}
	if cfg.Password != "" {
		opts.SetPassword(cfg.Password)
	}

	return &Client{
		inner: mqtt.NewClient(opts),
		cfg:   cfg,
	}
}

func (c *Client) Connect() error {
	tok := c.inner.Connect()
	tok.WaitTimeout(10 * time.Second)
	if err := tok.Error(); err != nil {
		return err
	}
	return nil
}

func (c *Client) Disconnect() {
	c.inner.Disconnect(250)
}

func (c *Client) Subscribe(subs []config.Subscription, handler MessageHandler) error {
	for _, s := range subs {
		sub := s
		var re *regexp.Regexp
		if sub.RegexFilter != "" {
			var err error
			re, err = regexp.Compile(sub.RegexFilter)
			if err != nil {
				return err
			}
		}
		tok := c.inner.Subscribe(sub.Topic, sub.QoS, func(_ mqtt.Client, msg mqtt.Message) {
			if re != nil && !re.Match(msg.Payload()) {
				return
			}
			handler(msg.Topic(), msg.Qos(), msg.Retained(), msg.Payload())
		})
		tok.WaitTimeout(5 * time.Second)
		if err := tok.Error(); err != nil {
			return err
		}
		log.Printf("[mqtt] subscribed %q (qos=%d)", sub.Topic, sub.QoS)
	}
	return nil
}

func (c *Client) ClientID() string { return c.cfg.ClientID }
