package com.example.meetingroom.dto;

import lombok.Data;

@Data
public class MeetingRoomQueryDTO {

    private String roomNumber;

    private String roomName;

    private Integer minCapacity;

    private Integer maxCapacity;

    private String location;

    private Boolean weekendAvailable;

    private Integer status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
