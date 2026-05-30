package com.mq.simulator.consumer;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.ConsumedMessage;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.DeliverCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;

public class RabbitMQConsumer implements MessageConsumer {
    private static final Logger logger = LoggerFactory.getLogger(RabbitMQConsumer.class);

    private ConnectionFactory factory;
    private Connection connection;
    private Channel channel;
    private MQConfig config;
    private volatile boolean running = false;
    private volatile boolean connected = false;
    private String consumerTag;
    private Consumer<ConsumedMessage> messageHandler;
    private ConcurrentLinkedQueue<ConsumedMessage> messageQueue;
    private List<String> subscribedQueues;

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

        messageQueue = new ConcurrentLinkedQueue<>();
        subscribedQueues = new ArrayList<>();
        logger.info("RabbitMQ consumer initialized: {}:{}", config.getHost(), config.getPort());
    }

    @Override
    public void connect() throws Exception {
        if (!connected) {
            try {
                connection = factory.newConnection();
                channel = connection.createChannel();
                connected = true;
                logger.info("RabbitMQ consumer connected successfully");
            } catch (IOException | TimeoutException e) {
                connected = false;
                throw new Exception("Failed to connect to RabbitMQ: " + e.getMessage(), e);
            }
        }
    }

    @Override
    public void subscribe(String topic) throws Exception {
        subscribe(Collections.singletonList(topic));
    }

    @Override
    public void subscribe(List<String> queues) throws Exception {
        if (!connected) {
            connect();
        }
        for (String queue : queues) {
            ensureQueueExists(queue);
            subscribedQueues.add(queue);
        }
        logger.info("RabbitMQ consumer subscribed to queues: {}", queues);
    }

    @Override
    public void subscribePattern(String pattern) throws Exception {
        throw new UnsupportedOperationException("Pattern subscribe not supported for RabbitMQ, use topic exchange instead");
    }

    @Override
    public void unsubscribe() throws Exception {
        if (consumerTag != null && channel != null && channel.isOpen()) {
            for (String queue : subscribedQueues) {
                try {
                    channel.basicCancel(consumerTag);
                } catch (Exception e) {
                    logger.warn("Failed to cancel consumer for queue {}: {}", queue, e.getMessage());
                }
            }
        }
        subscribedQueues.clear();
        consumerTag = null;
        logger.info("RabbitMQ consumer unsubscribed");
    }

    private void ensureQueueExists(String queue) throws Exception {
        try {
            channel.queueDeclarePassive(queue);
        } catch (IOException e) {
            logger.info("Queue {} does not exist, creating it", queue);
            channel.queueDeclare(queue, true, false, false, null);
        }
    }

    @Override
    public void start(Consumer<ConsumedMessage> messageHandler) throws Exception {
        if (running) {
            logger.warn("RabbitMQ consumer is already running");
            return;
        }

        if (!connected) {
            connect();
        }

        this.messageHandler = messageHandler;
        running = true;

        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
            ConsumedMessage message = new ConsumedMessage();
            message.setMessageId(delivery.getProperties().getMessageId());
            message.setTopic(delivery.getEnvelope().getRoutingKey());
            message.setConsumerGroup(config.getGroupId());
            message.setOffset(delivery.getEnvelope().getDeliveryTag());
            message.setRawContent(delivery.getBody());
            message.setContentType(delivery.getProperties().getContentType());
            message.setProcessSuccess(true);

            if (delivery.getProperties().getHeaders() != null) {
                message.setMessageId(delivery.getProperties().getHeaders()
                        .getOrDefault("messageId", message.getMessageId()).toString());
            }

            byte[] body = delivery.getBody();
            if (delivery.getProperties().getContentType() != null &&
                    (delivery.getProperties().getContentType().contains("avro") ||
                            delivery.getProperties().getContentType().contains("protobuf"))) {
                message.setContent("[Binary " + delivery.getProperties().getContentType() +
                        " data, " + body.length + " bytes]");
            } else {
                message.setContent(new String(body, StandardCharsets.UTF_8));
            }

            try {
                messageHandler.accept(message);
                if (config.isAutoCommit()) {
                    channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                }
            } catch (Exception e) {
                logger.error("Error handling message: {}", e.getMessage(), e);
                message.setProcessSuccess(false);
                message.setErrorMessage(e.getMessage());
                if (config.isAutoCommit()) {
                    channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                }
            }
        };

        for (String queue : subscribedQueues) {
            consumerTag = channel.basicConsume(queue, !config.isAutoCommit(), deliverCallback,
                    consumerTag1 -> logger.info("Consumer cancelled: {}", consumerTag1));
        }

        logger.info("RabbitMQ consumer started");
    }

    @Override
    public void stop() throws Exception {
        running = false;
        unsubscribe();
        logger.info("RabbitMQ consumer stopped");
    }

    @Override
    public List<ConsumedMessage> poll(int timeoutMs) throws Exception {
        List<ConsumedMessage> messages = new ArrayList<>();
        long endTime = System.currentTimeMillis() + timeoutMs;

        while (System.currentTimeMillis() < endTime) {
            ConsumedMessage message = messageQueue.poll();
            if (message != null) {
                messages.add(message);
            } else {
                Thread.sleep(100);
            }
        }

        return messages;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public boolean isConnected() {
        return connected && connection != null && connection.isOpen()
                && channel != null && channel.isOpen();
    }

    @Override
    public void commitOffset() throws Exception {
        logger.debug("RabbitMQ auto-commit handled per message");
    }

    @Override
    public void seekToBeginning() throws Exception {
        logger.warn("Seek not supported for RabbitMQ consumer");
    }

    @Override
    public void seekToEnd() throws Exception {
        logger.warn("Seek not supported for RabbitMQ consumer");
    }

    @Override
    public void disconnect() {
        connected = false;
        running = false;
        try {
            if (channel != null && channel.isOpen()) {
                channel.close();
            }
            if (connection != null && connection.isOpen()) {
                connection.close();
            }
            logger.info("RabbitMQ consumer disconnected");
        } catch (Exception e) {
            logger.warn("Error closing RabbitMQ connection: {}", e.getMessage());
        }
    }

    @Override
    public void close() {
        try {
            stop();
        } catch (Exception e) {
            logger.warn("Error stopping consumer: {}", e.getMessage());
        }
        disconnect();
    }
}
