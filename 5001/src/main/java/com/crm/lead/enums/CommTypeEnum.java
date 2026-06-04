package com.crm.lead.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum CommTypeEnum {

    TEXT("文字"),
    PHONE("电话"),
    MEETING("会面"),
    VOICE("语音"),
    IMAGE("图片"),
    VIDEO("视频");

    private final String desc;
}
