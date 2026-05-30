package com.mq.simulator.sender;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.SendResult;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

public class RabbitMQSender implements MessageSender {
    private static final Logger logger = LoggerFactory.getLogger(RabbitMQSender.class);

    private ConnectionFactory factory;
    private Connection connection;
    private Channel channel;
    private MQConfig config;
    private volatile boolean connected = false;

    @Override
    public void init(MQConfig config) throws Exception {
        this.config = config;
        factory = new ConnectionFactory();
        factory.setHost(config.getHost());
        factory.setPort(config.getPort());
        factory.setUsername(config.getUsername());
        factory.setPassword(config.getPassword());
        factory.setVirtualHost(config.getVirtualHost());
        factory.setConnectionTimeout(config.getConnectionTimeoutMs());
        factory.setAutomaticRecoveryEnabled(true);
        factory.setNetworkRecoveryInterval(5000);

        if (config.isUseTls()) {
            factory.useSslProtocol();
        }

        logger.info("RabbitMQ sender initialized: {}:{}", config.getHost(), config.getPort());
    }

    @Override
    public void connect() throws Exception {
        if (!connected) {
            try {
                connection = factory.newConnection();
                channel = connection.createChannel();
                connected = true;
                logger.info("RabbitMQ sender connected successfully");
            } catch (IOException | TimeoutException e) {
                connected = false;
                throw new Exception("Failed to connect to RabbitMQ: " + e.getMessage(), e);
            }
        }
    }

    @Override
    public SendResult send(Message message) throws Exception {
        if (!connected) {
            connect();
        }

        long startTime = System.currentTimeMillis();
        String exchange = message.getExchange() != null ? message.getExchange() : "";
        String routingKey = message.getRoutingKey() != null ? message.getRoutingKey() : message.getTopic();

        try {
            AMQP.BasicProperties properties = buildProperties(message);
            byte[] body = serializeMessage(message);

            channel.basicPublish(exchange, routingKey, properties, body);

            long latency = System.currentTimeMillis() - startTime;
            logger.debug("Message sent to RabbitMQ: {} -> {}, messageId: {}",
                    exchange, routingKey, message.getId());

            return SendResult.success(message.getId(), routingKey, latency);
        } catch (Exception e) {
            logger.error("Failed to send message to RabbitMQ: {}", e.getMessage(), e);
            return SendResult.failure(message.getId(), routingKey, e.getMessage());
        }
    }

    @Override
    public List<SendResult> sendBatch(List<Message> messages) throws Exception {
        if (!connected) {
            connect();
        }

        List<SendResult> results = new ArrayList<>();
        channel.confirmSelect();

        for (Message message : messages) {
            results.add(send(message));
        }

        channel.waitForConfirmsOrDie(5000);
        return results;
    }

    private AMQP.BasicProperties buildProperties(Message message) {
        AMQP.BasicProperties.Builder builder = new AMQP.BasicProperties.Builder();

        builder.messageId(message.getId());
        builder.contentType(getContentType(message));
        builder.deliveryMode(2);

        Map<String, Object> headers = new HashMap<>(message.getHeaders());
        if (message.getDelayLevel() != null) {
            headers.put("x-delay", message.getDelayLevel().getDelayMillis());
        }
        if (message.getCustomDelayMillis() > 0) {
            headers.put("x-delay", message.getCustomDelayMillis());
        }
        builder.headers(headers);

        if (message.getProperties() != null) {
            if (message.getProperties().containsKey("priority")) {
                builder.priority(((Number) message.getProperties().get("priority")).intValue());
            }
            if (message.getProperties().containsKey("expiration")) {
                builder.expiration(message.getProperties().get("expiration").toString());
            }
            if (message.getProperties().containsKey("correlationId")) {
                builder.correlationId(message.getProperties().get("correlationId").toString());
            }
            if (message.getProperties().containsKey("replyTo")) {
                builder.replyTo(message.getProperties().get("replyTo").toString());
            }
        }

        return builder.build();
    }

    private String getContentType(Message message) {
        if (message.getFormat() == null) {
            return "text/plain";
        }
        switch (message.getFormat()) {
            case JSON:
                return "application/json";
            case XML:
                return "application/xml";
            case AVRO:
                return "application/avro";
            case PROTOBUF:
                return "application/protobuf";
            default:
                return "text/plain";
        }
    }

    private byte[] serializeMessage(Message message) {
        return message.getContent().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean isConnected() {
        return connected && connection != null && connection.isOpen()
                && channel != null && channel.isOpen();
    }

    @Override
    public void disconnect() {
        connected = false;
        try {
            if (channel != null && channel.isOpen()) {
                channel.close();
            }
            if (connection != null && connection.isOpen()) {
                connection.close();
            }
            logger.info("RabbitMQ sender disconnected");
        } catch (Exception e) {
            logger.warn("Error closing RabbitMQ connection: {}", e.getMessage());
        }
    }

    @Override
    public void close() {
        disconnect();
    }
}
