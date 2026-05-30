package com.mq.simulator.consumer;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.model.ConsumedMessage;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.regex.Pattern;
import java.util.function.Consumer;

public class KafkaConsumerImpl implements MessageConsumer {
    private static final Logger logger = LoggerFactory.getLogger(KafkaConsumerImpl.class);

    private org.apache.kafka.clients.consumer.KafkaConsumer<String, byte[]> consumer;
    private MQConfig config;
    private volatile boolean running = false;
    private volatile boolean connected = false;
    private Thread consumerThread;
    private Consumer<ConsumedMessage> messageHandler;
    private List<String> subscribedTopics;
    private String subscribedPattern;

    @Override
    public void init(MQConfig config) throws Exception {
        this.config = config;

        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, config.getBootstrapServers());
        props.put(ConsumerConfig.GROUP_ID_CONFIG, config.getGroupId());
        props.put(ConsumerConfig.CLIENT_ID_CONFIG, config.getClientId());
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, "org.apache.kafka.common.serialization.StringDeserializer");
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, "org.apache.kafka.common.serialization.ByteArrayDeserializer");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, config.isAutoCommit());
        props.put(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, config.getAutoCommitIntervalMs());
        props.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, config.getSessionTimeoutMs());
        props.put(ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG, config.getSessionTimeoutMs() / 3);
        props.put(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 300000);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest");
        props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 1);
        props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 500);

        if (config.isUseTls() && config.getSecurityProtocol() != null) {
            props.put("security.protocol", config.getSecurityProtocol());
            if (config.getSaslMechanism() != null) {
                props.put("sasl.mechanism", config.getSaslMechanism());
            }
        }

        consumer = new org.apache.kafka.clients.consumer.KafkaConsumer<>(props);
        connected = true;
        subscribedTopics = new ArrayList<>();
        logger.info("Kafka consumer initialized: {}", config.getBootstrapServers());
    }

    @Override
    public void connect() {
        connected = true;
    }

    @Override
    public void subscribe(String topic) throws Exception {
        subscribe(Collections.singletonList(topic));
    }

    @Override
    public void subscribe(List<String> topics) throws Exception {
        if (!connected) {
            connect();
        }
        consumer.subscribe(topics);
        subscribedTopics = new ArrayList<>(topics);
        subscribedPattern = null;
        logger.info("Kafka consumer subscribed to topics: {}", topics);
    }

    @Override
    public void subscribePattern(String pattern) throws Exception {
        if (!connected) {
            connect();
        }
        consumer.subscribe(Pattern.compile(pattern));
        subscribedPattern = pattern;
        subscribedTopics = null;
        logger.info("Kafka consumer subscribed to pattern: {}", pattern);
    }

    @Override
    public void unsubscribe() throws Exception {
        consumer.unsubscribe();
        subscribedTopics = null;
        subscribedPattern = null;
        logger.info("Kafka consumer unsubscribed");
    }

    @Override
    public void start(Consumer<ConsumedMessage> messageHandler) throws Exception {
        if (running) {
            logger.warn("Kafka consumer is already running");
            return;
        }

        this.messageHandler = messageHandler;
        running = true;

        consumerThread = new Thread(() -> {
            logger.info("Kafka consumer thread started");
            while (running && connected) {
                try {
                    ConsumerRecords<String, byte[]> records = consumer.poll(Duration.ofMillis(1000));
                    for (ConsumerRecord<String, byte[]> record : records) {
                        ConsumedMessage consumedMessage = convertRecord(record);
                        try {
                            messageHandler.accept(consumedMessage);
                        } catch (Exception e) {
                            logger.error("Error handling message: {}", e.getMessage(), e);
                            consumedMessage.setProcessSuccess(false);
                            consumedMessage.setErrorMessage(e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    if (running) {
                        logger.error("Error polling messages: {}", e.getMessage(), e);
                        try {
                            Thread.sleep(1000);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            }
            logger.info("Kafka consumer thread stopped");
        }, "kafka-consumer-thread");

        consumerThread.setDaemon(true);
        consumerThread.start();
    }

    @Override
    public void stop() throws Exception {
        running = false;
        if (consumerThread != null) {
            consumerThread.interrupt();
            consumerThread.join(5000);
        }
        logger.info("Kafka consumer stopped");
    }

    @Override
    public List<ConsumedMessage> poll(int timeoutMs) throws Exception {
        List<ConsumedMessage> messages = new ArrayList<>();
        ConsumerRecords<String, byte[]> records = consumer.poll(Duration.ofMillis(timeoutMs));
        for (ConsumerRecord<String, byte[]> record : records) {
            messages.add(convertRecord(record));
        }
        return messages;
    }

    private ConsumedMessage convertRecord(ConsumerRecord<String, byte[]> record) {
        ConsumedMessage message = new ConsumedMessage();
        message.setMessageId(record.key());
        message.setTopic(record.topic());
        message.setConsumerGroup(config.getGroupId());
        message.setOffset(record.offset());
        message.setPartition(record.partition());
        message.setRawContent(record.value());
        message.setProcessSuccess(true);

        String contentType = null;
        for (Header header : record.headers()) {
            if ("content-type".equalsIgnoreCase(header.key())) {
                contentType = new String(header.value(), StandardCharsets.UTF_8);
            }
        }

        message.setContentType(contentType);
        message.setContent(determineContent(record.value(), contentType));

        return message;
    }

    private String determineContent(byte[] value, String contentType) {
        if (value == null) {
            return null;
        }
        if (contentType != null && (contentType.contains("avro") || contentType.contains("protobuf"))) {
            return "[Binary " + contentType + " data, " + value.length + " bytes]";
        }
        return new String(value, StandardCharsets.UTF_8);
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public boolean isConnected() {
        return connected && consumer != null;
    }

    @Override
    public void commitOffset() throws Exception {
        consumer.commitSync();
        logger.debug("Offsets committed");
    }

    @Override
    public void seekToBeginning() throws Exception {
        consumer.seekToBeginning(consumer.assignment());
        logger.info("Seeked to beginning");
    }

    @Override
    public void seekToEnd() throws Exception {
        consumer.seekToEnd(consumer.assignment());
        logger.info("Seeked to end");
    }

    @Override
    public void disconnect() {
        connected = false;
        running = false;
    }

    @Override
    public void close() {
        try {
            stop();
        } catch (Exception e) {
            logger.warn("Error stopping consumer: {}", e.getMessage());
        }
        if (consumer != null) {
            consumer.close();
            logger.info("Kafka consumer closed");
        }
        connected = false;
    }
}
