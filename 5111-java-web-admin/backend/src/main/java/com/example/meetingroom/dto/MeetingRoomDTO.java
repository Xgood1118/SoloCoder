package com.example.meetingroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalTime;

@Data
public class MeetingRoomDTO {

    private Long id;

    @NotBlank(message = "会议室编号不能为空")
    private String roomNumber;

    @NotBlank(message = "会议室名称不能为空")
    private String roomName;

    @NotNull(message = "容纳人数不能为空")
    private Integer capacity;

    private String location;

    private LocalTime openTime;

    private LocalTime closeTime;

    private Boolean weekendAvailable = false;

    private String description;

    private Integer status = 1;
}
