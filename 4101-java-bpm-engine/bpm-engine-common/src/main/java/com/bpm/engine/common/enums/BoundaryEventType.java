package com.bpm.engine.common.enums;

import lombok.Getter;
import lombok.AllArgsConstructor;

@Getter
@AllArgsConstructor
public enum BoundaryEventType {

    TIMER,
    ERROR,
    MESSAGE,
    SIGNAL,
    ESCALATION,
    CANCEL,
    COMPENSATION
}
