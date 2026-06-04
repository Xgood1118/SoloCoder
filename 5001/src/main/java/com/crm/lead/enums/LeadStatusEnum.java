package com.crm.lead.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum LeadStatusEnum {

    PENDING_ASSIGN("待分配"),
    ASSIGNED("已分配"),
    PENDING_CONFIRM("待确认"),
    FOLLOWING("跟进中"),
    DEALED("已成交"),
    CLOSED("已关闭"),
    IN_POOL("公海池中");

    private final String desc;
}
