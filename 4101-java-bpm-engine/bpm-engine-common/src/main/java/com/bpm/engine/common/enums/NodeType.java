package com.bpm.engine.common.enums;

import lombok.Getter;
import lombok.AllArgsConstructor;

@Getter
@AllArgsConstructor
public enum NodeType {

    START_EVENT,
    END_EVENT,
    USER_TASK,
    SERVICE_TASK,
    SCRIPT_TASK,
    EXCLUSIVE_GATEWAY,
    PARALLEL_GATEWAY,
    INCLUSIVE_GATEWAY,
    EVENT_GATEWAY,
    SUBPROCESS,
    CALL_ACTIVITY,
    BOUNDARY_EVENT,
    INTERMEDIATE_CATCH_EVENT,
    INTERMEDIATE_THROW_EVENT
}
