package com.mq.simulator.model;

import java.time.LocalDateTime;

public class ConsumedMessage {
    private String messageId;
    private String topic;
    private String consumerGroup;
    private String content;
    private byte[] rawContent;
    private String contentType;
    private long offset;
    private int partition;
    private LocalDateTime receivedAt;
    private boolean filtered;
    private String filterReason;
    private boolean processSuccess;
    private String errorMessage;

    public ConsumedMessage() {
        this.receivedAt = LocalDateTime.now();
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getConsumerGroup() {
        return consumerGroup;
    }

    public void setConsumerGroup(String consumerGroup) {
        this.consumerGroup = consumerGroup;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public byte[] getRawContent() {
        return rawContent;
    }

    public void setRawContent(byte[] rawContent) {
        this.rawContent = rawContent;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getOffset() {
        return offset;
    }

    public void setOffset(long offset) {
        this.offset = offset;
    }

    public int getPartition() {
        return partition;
    }

    public void setPartition(int partition) {
        this.partition = partition;
    }

    public LocalDateTime getReceivedAt() {
        return receivedAt;
    }

    public void setReceivedAt(LocalDateTime receivedAt) {
        this.receivedAt = receivedAt;
    }

    public boolean isFiltered() {
        return filtered;
    }

    public void setFiltered(boolean filtered) {
        this.filtered = filtered;
    }

    public String getFilterReason() {
        return filterReason;
    }

    public void setFilterReason(String filterReason) {
        this.filterReason = filterReason;
    }

    public boolean isProcessSuccess() {
        return processSuccess;
    }

    public void setProcessSuccess(boolean processSuccess) {
        this.processSuccess = processSuccess;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    @Override
    public String toString() {
        return "ConsumedMessage{" +
                "messageId='" + messageId + '\'' +
                ", topic='" + topic + '\'' +
                ", consumerGroup='" + consumerGroup + '\'' +
                ", offset=" + offset +
                ", partition=" + partition +
                ", receivedAt=" + receivedAt +
                ", processSuccess=" + processSuccess +
                '}';
    }
}
