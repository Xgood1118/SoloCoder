package com.mq.simulator.model;

import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

public class RecordedMessage {
    private String id;
    private MQType mqType;
    private MessageFormat format;
    private String topic;
    private String routingKey;
    private String exchange;
    private String content;
    private Map<String, String> headers;
    private LocalDateTime recordedAt;
    private long originalTimestamp;
    private long relativeOffsetMs;
    private int partition;
    private long offset;
    private String consumerGroup;
    private Map<String, Object> metadata;

    public RecordedMessage() {
        this.recordedAt = LocalDateTime.now();
        this.headers = new HashMap<>();
        this.metadata = new HashMap<>();
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

    public LocalDateTime getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(LocalDateTime recordedAt) {
        this.recordedAt = recordedAt;
    }

    public long getOriginalTimestamp() {
        return originalTimestamp;
    }

    public void setOriginalTimestamp(long originalTimestamp) {
        this.originalTimestamp = originalTimestamp;
    }

    public long getRelativeOffsetMs() {
        return relativeOffsetMs;
    }

    public void setRelativeOffsetMs(long relativeOffsetMs) {
        this.relativeOffsetMs = relativeOffsetMs;
    }

    public int getPartition() {
        return partition;
    }

    public void setPartition(int partition) {
        this.partition = partition;
    }

    public long getOffset() {
        return offset;
    }

    public void setOffset(long offset) {
        this.offset = offset;
    }

    public String getConsumerGroup() {
        return consumerGroup;
    }

    public void setConsumerGroup(String consumerGroup) {
        this.consumerGroup = consumerGroup;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public Message toMessage() {
        Message message = new Message();
        message.setMqType(this.mqType);
        message.setFormat(this.format);
        message.setTopic(this.topic);
        message.setExchange(this.exchange);
        message.setRoutingKey(this.routingKey);
        message.setContent(this.content);
        message.getHeaders().putAll(this.headers);
        return message;
    }

    @Override
    public String toString() {
        return "RecordedMessage{" +
                "id='" + id + '\'' +
                ", mqType=" + mqType +
                ", topic='" + topic + '\'' +
                ", recordedAt=" + recordedAt +
                ", relativeOffsetMs=" + relativeOffsetMs +
                '}';
    }
}
