package com.example.meetingroom.enums;

import lombok.Getter;

@Getter
public enum EquipmentStatus {
    INACTIVE(0, "停用"),
    ACTIVE(1, "正常");

    private final Integer code;
    private final String desc;

    EquipmentStatus(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static EquipmentStatus fromCode(Integer code) {
        for (EquipmentStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}
