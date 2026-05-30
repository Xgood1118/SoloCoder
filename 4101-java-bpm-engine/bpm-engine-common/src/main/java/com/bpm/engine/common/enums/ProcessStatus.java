package com.bpm.engine.common.enums;

import lombok.Getter;
import lombok.AllArgsConstructor;

@Getter
@AllArgsConstructor
public enum ProcessStatus {

    PENDING,
    RUNNING,
    SUSPENDED,
    COMPLETED,
    TERMINATED,
    DELETED
}
