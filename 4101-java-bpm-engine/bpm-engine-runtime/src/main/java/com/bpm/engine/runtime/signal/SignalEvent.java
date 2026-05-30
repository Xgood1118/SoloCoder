package com.bpm.engine.runtime.signal;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SignalEvent {

    private String signalId;
    private String signalName;
    private String processInstanceId;
    private String executionId;
    private Map<String, Object> payload;
}
