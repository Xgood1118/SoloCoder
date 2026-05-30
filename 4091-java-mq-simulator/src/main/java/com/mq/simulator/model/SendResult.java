package com.mq.simulator.model;

import java.time.LocalDateTime;

public class SendResult {
    private String messageId;
    private boolean success;
    private String topic;
    private LocalDateTime sentAt;
    private String errorMessage;
    private long latencyMs;
    private int retryCount;

    public SendResult() {
        this.sentAt = LocalDateTime.now();
    }

    public static SendResult success(String messageId, String topic) {
        SendResult result = new SendResult();
        result.setSuccess(true);
        result.setMessageId(messageId);
        result.setTopic(topic);
        return result;
    }

    public static SendResult success(String messageId, String topic, long latencyMs) {
        SendResult result = success(messageId, topic);
        result.setLatencyMs(latencyMs);
        return result;
    }

    public static SendResult failure(String messageId, String topic, String errorMessage) {
        SendResult result = new SendResult();
        result.setSuccess(false);
        result.setMessageId(messageId);
        result.setTopic(topic);
        result.setErrorMessage(errorMessage);
        return result;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public LocalDateTime getSentAt() {
        return sentAt;
    }

    public void setSentAt(LocalDateTime sentAt) {
        this.sentAt = sentAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(long latencyMs) {
        this.latencyMs = latencyMs;
    }

    public int getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }

    @Override
    public String toString() {
        if (success) {
            return String.format("SendResult[SUCCESS] messageId=%s, topic=%s, latency=%dms",
                    messageId, topic, latencyMs);
        } else {
            return String.format("SendResult[FAILURE] messageId=%s, topic=%s, error=%s",
                    messageId, topic, errorMessage);
        }
    }
}
