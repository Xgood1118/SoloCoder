package com.example.meetingroom.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReservationQueryDTO {

    private Long roomId;

    private String roomNumber;

    private String reserverName;

    private String meetingTopic;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
