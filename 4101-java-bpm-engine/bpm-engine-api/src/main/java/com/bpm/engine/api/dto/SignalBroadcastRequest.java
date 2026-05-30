package com.bpm.engine.api.dto;

import lombok.Data;

import java.util.Map;

@Data
public class SignalBroadcastRequest {

    private String signalId;
    private Map<String, Object> payload;
}
