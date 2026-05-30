package com.bpm.engine.runtime.signal;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class MessageEvent {

    private String messageId;
    private String messageName;
    private String targetProcessInstanceId;
    private String targetExecutionId;
    private Map<String, Object> payload;
}
