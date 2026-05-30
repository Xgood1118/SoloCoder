package mq

import (
	"parking-billing/config"

	amqp "github.com/rabbitmq/amqp091-go"
)

var Conn *amqp.Connection
var Ch *amqp.Channel

func Init(cfg config.RabbitMQConfig) error {
	var err error
	Conn, err = amqp.Dial(cfg.URL)
	if err != nil {
		return err
	}
	Ch, err = Conn.Channel()
	if err != nil {
		return err
	}
	return nil
}

func DeclareQueue(name string) (amqp.Queue, error) {
	return Ch.QueueDeclare(
		name,
		true,
		false,
		false,
		false,
		nil,
	)
}

func Publish(queue string, body []byte) error {
	_, err := DeclareQueue(queue)
	if err != nil {
		return err
	}
	return Ch.Publish(
		"",
		queue,
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)
}

func Close() {
	if Ch != nil {
		Ch.Close()
	}
	if Conn != nil {
		Conn.Close()
	}
}
