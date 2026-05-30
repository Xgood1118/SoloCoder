package com.mq.simulator.sender;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.SendResult;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class KafkaSender implements MessageSender {
    private static final Logger logger = LoggerFactory.getLogger(KafkaSender.class);

    private KafkaProducer<String, byte[]> producer;
    private MQConfig config;
    private volatile boolean connected = false;

    @Override
    public void init(MQConfig config) throws Exception {
        this.config = config;

        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, config.getBootstrapServers());
        props.put(ProducerConfig.CLIENT_ID_CONFIG, config.getClientId());
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, "org.apache.kafka.common.serialization.StringSerializer");
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, "org.apache.kafka.common.serialization.ByteArraySerializer");
        props.put(ProducerConfig.ACKS_CONFIG, config.getAcks());
        props.put(ProducerConfig.RETRIES_CONFIG, config.getRetries());
        props.put(ProducerConfig.LINGER_MS_CONFIG, config.getLingerMs());
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, config.getBatchSize());
        props.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, config.getRequestTimeoutMs());
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, config.getRequestTimeoutMs() + 10000);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, false);

        if (config.isUseTls() && config.getSecurityProtocol() != null) {
            props.put("security.protocol", config.getSecurityProtocol());
            if (config.getSaslMechanism() != null) {
                props.put("sasl.mechanism", config.getSaslMechanism());
            }
        }

        producer = new KafkaProducer<>(props);
        logger.info("Kafka sender initialized: {}", config.getBootstrapServers());
        connected = true;
    }

    @Override
    public void connect() {
        if (!connected) {
            connected = true;
            logger.info("Kafka sender connected");
        }
    }

    @Override
    public SendResult send(Message message) throws Exception {
        if (!connected) {
            connect();
        }

        long startTime = System.currentTimeMillis();
        String topic = message.getTopic();

        try {
            ProducerRecord<String, byte[]> record = buildRecord(message);
            Future<RecordMetadata> future = producer.send(record);
            RecordMetadata metadata = future.get(config.getRequestTimeoutMs(), TimeUnit.MILLISECONDS);

            long latency = System.currentTimeMillis() - startTime;
            logger.debug("Message sent to Kafka: {} [{}], offset: {}, messageId: {}",
                    topic, metadata.partition(), metadata.offset(), message.getId());

            SendResult result = SendResult.success(message.getId(), topic, latency);
            result.setRetryCount(message.getRetryCount());
            return result;
        } catch (InterruptedException | ExecutionException | TimeoutException e) {
            logger.error("Failed to send message to Kafka: {}", e.getMessage(), e);
            return SendResult.failure(message.getId(), topic, e.getMessage());
        }
    }

    @Override
    public List<SendResult> sendBatch(List<Message> messages) throws Exception {
        if (!connected) {
            connect();
        }

        List<Future<RecordMetadata>> futures = new ArrayList<>();
        List<SendResult> results = new ArrayList<>();
        long[] startTimes = new long[messages.size()];

        for (int i = 0; i < messages.size(); i++) {
            Message message = messages.get(i);
            startTimes[i] = System.currentTimeMillis();
            ProducerRecord<String, byte[]> record = buildRecord(message);
            futures.add(producer.send(record));
        }

        producer.flush();

        for (int i = 0; i < futures.size(); i++) {
            Future<RecordMetadata> future = futures.get(i);
            Message message = messages.get(i);
            try {
                RecordMetadata metadata = future.get(config.getRequestTimeoutMs(), TimeUnit.MILLISECONDS);
                long latency = System.currentTimeMillis() - startTimes[i];
                results.add(SendResult.success(message.getId(), message.getTopic(), latency));
            } catch (Exception e) {
                results.add(SendResult.failure(message.getId(), message.getTopic(), e.getMessage()));
            }
        }

        return results;
    }

    private ProducerRecord<String, byte[]> buildRecord(Message message) {
        String topic = message.getTopic();
        byte[] value = serializeMessage(message);
        String key = message.getId();

        ProducerRecord<String, byte[]> record = new ProducerRecord<>(topic, key, value);

        for (java.util.Map.Entry<String, String> entry : message.getHeaders().entrySet()) {
            record.headers().add(new RecordHeader(entry.getKey(),
                    entry.getValue().getBytes(StandardCharsets.UTF_8)));
        }

        if (message.getDelayLevel() != null) {
            record.headers().add(new RecordHeader("x-delay",
                    String.valueOf(message.getDelayLevel().getDelayMillis()).getBytes(StandardCharsets.UTF_8)));
        }
        if (message.getCustomDelayMillis() > 0) {
            record.headers().add(new RecordHeader("x-delay",
                    String.valueOf(message.getCustomDelayMillis()).getBytes(StandardCharsets.UTF_8)));
        }

        if (message.getProperties() != null && message.getProperties().containsKey("partition")) {
            int partition = ((Number) message.getProperties().get("partition")).intValue();
            record = new ProducerRecord<>(topic, partition, key, value);
            for (Header header : record.headers()) {
                record.headers().add(header);
            }
        }

        return record;
    }

    private byte[] serializeMessage(Message message) {
        return message.getContent().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean isConnected() {
        return connected && producer != null;
    }

    @Override
    public void disconnect() {
        connected = false;
        if (producer != null) {
            producer.close();
            logger.info("Kafka sender disconnected");
        }
    }

    @Override
    public void close() {
        disconnect();
    }
}
