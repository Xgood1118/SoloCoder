package com.example.meetingroom.enums;

import lombok.Getter;

@Getter
public enum ReservationStatus {
    PENDING(0, "待确认"),
    CONFIRMED(1, "已确认"),
    CANCELLED(2, "已取消"),
    COMPLETED(3, "已完成");

    private final Integer code;
    private final String desc;

    ReservationStatus(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static ReservationStatus fromCode(Integer code) {
        for (ReservationStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}
