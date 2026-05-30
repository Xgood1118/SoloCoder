package com.bpm.engine.common.enums;

import lombok.Getter;
import lombok.AllArgsConstructor;

@Getter
@AllArgsConstructor
public enum TaskStatus {

    CREATED,
    CLAIMED,
    COMPLETED,
    REJECTED,
    DELEGATED,
    TRANSFERRED,
    CANCELLED
}
