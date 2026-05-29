package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"mqtt-bridge/config"
	"mqtt-bridge/converter"
	"mqtt-bridge/deduplicator"
	mqttclient "mqtt-bridge/mqttclient"
	"mqtt-bridge/webhook"
)

func main() {
	cfgPath := flag.String("config", "config.json", "path to config file (yaml or json)")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	conv, err := converter.New(cfg.Converter.Template)
	if err != nil {
		log.Fatalf("init converter: %v", err)
	}

	dedup := deduplicator.New(cfg.Deduplicator.WindowSeconds)
	defer dedup.Stop()

	sender := webhook.New(
		cfg.Webhook.URL,
		cfg.Webhook.Method,
		cfg.Webhook.Headers,
		cfg.Webhook.TimeoutSeconds,
		cfg.Webhook.MaxRetries,
		cfg.Webhook.BaseBackoffSec,
		cfg.Webhook.MaxBackoffSec,
	)
	defer sender.Stop()

	client := mqttclient.New(cfg.MQTT)
	if err := client.Connect(); err != nil {
		log.Fatalf("mqtt connect: %v", err)
	}
	defer client.Disconnect()

	clientID := client.ClientID()

	handler := func(topic string, qos byte, retain bool, payload []byte) {
		key := dedup.Key(clientID, topic, payload)
		if dedup.IsDuplicate(key) {
			log.Printf("[bridge] duplicate message ignored (topic=%s)", topic)
			return
		}
		body, err := conv.BuildBody(topic, qos, retain, payload)
		if err != nil {
			log.Printf("[bridge] convert failed: %v", err)
			return
		}
		if err := sender.Send(body); err != nil {
			log.Printf("[bridge] send failed (queued for retry): %v", err)
		} else {
			log.Printf("[bridge] delivered topic=%s", topic)
		}
	}

	if err := client.Subscribe(cfg.Subscriptions, handler); err != nil {
		log.Fatalf("mqtt subscribe: %v", err)
	}

	log.Printf("[bridge] started, waiting for messages...")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Printf("[bridge] shutting down")
}
