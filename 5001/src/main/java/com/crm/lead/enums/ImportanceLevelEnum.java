package com.crm.lead.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ImportanceLevelEnum {

    NORMAL(1, "普通"),
    IMPORTANT(2, "重要"),
    CRITICAL(3, "关键");

    private final Integer code;

    private final String desc;
}
