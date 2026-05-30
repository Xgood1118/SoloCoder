package com.bpm.engine.common.enums;

import lombok.Getter;
import lombok.AllArgsConstructor;

@Getter
@AllArgsConstructor
public enum GatewayType {

    EXCLUSIVE,
    PARALLEL,
    INCLUSIVE,
    EVENT
}
