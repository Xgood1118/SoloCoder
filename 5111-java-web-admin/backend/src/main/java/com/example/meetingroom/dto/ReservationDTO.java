package com.example.meetingroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReservationDTO {

    private Long id;

    @NotNull(message = "会议室ID不能为空")
    private Long roomId;

    private String roomNumber;

    private String roomName;

    @NotNull(message = "开始时间不能为空")
    private LocalDateTime startTime;

    @NotNull(message = "结束时间不能为空")
    private LocalDateTime endTime;

    @NotBlank(message = "预定人姓名不能为空")
    private String reserverName;

    private String reserverPhone;

    private String meetingTopic;

    private Integer participants;

    private Integer status = 1;
}
