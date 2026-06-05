package com.example.meetingroom.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class EquipmentLockLogQueryDTO {

    private Long equipmentId;

    private String equipmentCode;

    private Long reservationId;

    private Long roomId;

    private String lockType;

    private String operator;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
