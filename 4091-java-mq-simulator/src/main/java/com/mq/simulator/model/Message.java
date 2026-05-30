package com.mq.simulator.model;

import com.mq.simulator.core.DelayLevel;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class Message {
    private String id;
    private MQType mqType;
    private MessageFormat format;
    private String topic;
    private String routingKey;
    private String exchange;
    private String queue;
    private String content;
    private Map<String, String> headers;
    private Map<String, Object> properties;
    private DelayLevel delayLevel;
    private long customDelayMillis;
    private int retryCount;
    private int maxRetryCount;
    private LocalDateTime createdAt;
    private LocalDateTime scheduledAt;
    private LocalDateTime sentAt;

    public Message() {
        this.id = UUID.randomUUID().toString();
        this.createdAt = LocalDateTime.now();
        this.headers = new HashMap<>();
        this.properties = new HashMap<>();
        this.retryCount = 0;
        this.maxRetryCount = 3;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public MQType getMqType() {
        return mqType;
    }

    public void setMqType(MQType mqType) {
        this.mqType = mqType;
    }

    public MessageFormat getFormat() {
        return format;
    }

    public void setFormat(MessageFormat format) {
        this.format = format;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getRoutingKey() {
        return routingKey;
    }

    public void setRoutingKey(String routingKey) {
        this.routingKey = routingKey;
    }

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getQueue() {
        return queue;
    }

    public void setQueue(String queue) {
        this.queue = queue;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Map<String, String> getHeaders() {
        return headers;
    }

    public void setHeaders(Map<String, String> headers) {
        this.headers = headers;
    }

    public void addHeader(String key, String value) {
        this.headers.put(key, value);
    }

    public Map<String, Object> getProperties() {
        return properties;
    }

    public void setProperties(Map<String, Object> properties) {
        this.properties = properties;
    }

    public DelayLevel getDelayLevel() {
        return delayLevel;
    }

    public void setDelayLevel(DelayLevel delayLevel) {
        this.delayLevel = delayLevel;
    }

    public long getCustomDelayMillis() {
        return customDelayMillis;
    }

    public void setCustomDelayMillis(long customDelayMillis) {
        this.customDelayMillis = customDelayMillis;
    }

    public long getEffectiveDelayMillis() {
        if (customDelayMillis > 0) {
            return customDelayMillis;
        }
        if (delayLevel != null) {
            return delayLevel.getDelayMillis();
        }
        return 0;
    }

    public int getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }

    public void incrementRetryCount() {
        this.retryCount++;
    }

    public int getMaxRetryCount() {
        return maxRetryCount;
    }

    public void setMaxRetryCount(int maxRetryCount) {
        this.maxRetryCount = maxRetryCount;
    }

    public boolean shouldRetry() {
        return retryCount < maxRetryCount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(LocalDateTime scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public LocalDateTime getSentAt() {
        return sentAt;
    }

    public void setSentAt(LocalDateTime sentAt) {
        this.sentAt = sentAt;
    }

    @Override
    public String toString() {
        return "Message{" +
                "id='" + id + '\'' +
                ", mqType=" + mqType +
                ", format=" + format +
                ", topic='" + topic + '\'' +
                ", routingKey='" + routingKey + '\'' +
                ", queue='" + queue + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
