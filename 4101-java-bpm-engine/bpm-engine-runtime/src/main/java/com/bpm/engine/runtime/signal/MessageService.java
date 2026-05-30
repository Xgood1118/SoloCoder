package com.bpm.engine.runtime.signal;

import java.time.LocalDateTime;
import java.util.Map;

public interface MessageService {

    void sendMessage(String messageId, String targetProcessInstanceId, String targetExecutionId,
                     Map<String, Object> payload);

    void correlateMessage(String messageName, String businessKey, Map<String, Object> payload);

    void sendMessageWithTimeout(String messageId, String targetProcessInstanceId, String targetExecutionId,
                                Map<String, Object> payload, LocalDateTime timeout, String timeoutAction);
}
