package com.example.meetingroom.enums;

import lombok.Getter;

@Getter
public enum LockType {
    LOCK("LOCK", "锁定"),
    UNLOCK("UNLOCK", "解锁"),
    FORCE_UNLOCK("FORCE_UNLOCK", "强制解锁");

    private final String code;
    private final String desc;

    LockType(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static LockType fromCode(String code) {
        for (LockType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }
}
