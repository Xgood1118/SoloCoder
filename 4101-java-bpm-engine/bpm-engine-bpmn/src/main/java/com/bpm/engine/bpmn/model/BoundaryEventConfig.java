package com.bpm.engine.bpmn.model;

import com.bpm.engine.common.enums.BoundaryEventType;
import lombok.Data;

@Data
public class BoundaryEventConfig {

    private BoundaryEventType eventType;
    private String attachedToRef;
    private boolean cancelActivity;
    private TimerConfig timerConfig;
    private String errorCode;
    private String messageRef;
    private String signalRef;
}
