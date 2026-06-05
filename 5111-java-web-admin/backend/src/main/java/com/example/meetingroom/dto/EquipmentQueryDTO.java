package com.example.meetingroom.dto;

import lombok.Data;

@Data
public class EquipmentQueryDTO {

    private String equipmentCode;

    private String equipmentName;

    private String equipmentType;

    private Long roomId;

    private Boolean unboundOnly;

    private Integer status;

    private Boolean locked;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
