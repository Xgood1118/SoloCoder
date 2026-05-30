package com.mq.simulator.model;

import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class MessageTemplate {
    private String id;
    private String name;
    private String description;
    private String category;
    private MQType mqType;
    private MessageFormat format;
    private String defaultTopic;
    private String defaultExchange;
    private String defaultRoutingKey;
    private String defaultQueue;
    private String content;
    private Map<String, String> placeholders;
    private Map<String, String> defaultHeaders;
    private Map<String, String> sampleValues;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String version;

    public MessageTemplate() {
        this.id = UUID.randomUUID().toString();
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.placeholders = new HashMap<>();
        this.defaultHeaders = new HashMap<>();
        this.sampleValues = new HashMap<>();
        this.version = "1.0";
    }

    public MessageTemplate(String name, String content) {
        this();
        this.name = name;
        this.content = content;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
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

    public String getDefaultTopic() {
        return defaultTopic;
    }

    public void setDefaultTopic(String defaultTopic) {
        this.defaultTopic = defaultTopic;
    }

    public String getDefaultExchange() {
        return defaultExchange;
    }

    public void setDefaultExchange(String defaultExchange) {
        this.defaultExchange = defaultExchange;
    }

    public String getDefaultRoutingKey() {
        return defaultRoutingKey;
    }

    public void setDefaultRoutingKey(String defaultRoutingKey) {
        this.defaultRoutingKey = defaultRoutingKey;
    }

    public String getDefaultQueue() {
        return defaultQueue;
    }

    public void setDefaultQueue(String defaultQueue) {
        this.defaultQueue = defaultQueue;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
        this.updatedAt = LocalDateTime.now();
    }

    public Map<String, String> getPlaceholders() {
        return placeholders;
    }

    public void setPlaceholders(Map<String, String> placeholders) {
        this.placeholders = placeholders;
    }

    public void addPlaceholder(String key, String description) {
        this.placeholders.put(key, description);
    }

    public Map<String, String> getDefaultHeaders() {
        return defaultHeaders;
    }

    public void setDefaultHeaders(Map<String, String> defaultHeaders) {
        this.defaultHeaders = defaultHeaders;
    }

    public Map<String, String> getSampleValues() {
        return sampleValues;
    }

    public void setSampleValues(Map<String, String> sampleValues) {
        this.sampleValues = sampleValues;
    }

    public void addSampleValue(String key, String value) {
        this.sampleValues.put(key, value);
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public Message toMessage() {
        Message message = new Message();
        message.setMqType(this.mqType);
        message.setFormat(this.format);
        message.setTopic(this.defaultTopic);
        message.setExchange(this.defaultExchange);
        message.setRoutingKey(this.defaultRoutingKey);
        message.setQueue(this.defaultQueue);
        message.setContent(this.content);
        message.getHeaders().putAll(this.defaultHeaders);
        return message;
    }

    @Override
    public String toString() {
        return "MessageTemplate{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", category='" + category + '\'' +
                ", mqType=" + mqType +
                ", format=" + format +
                ", createdAt=" + createdAt +
                '}';
    }
}
