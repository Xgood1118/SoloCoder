package com.example.meetingroom.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class EquipmentDTO {

    private Long id;

    @NotBlank(message = "设备编号不能为空")
    private String equipmentCode;

    @NotBlank(message = "设备名称不能为空")
    private String equipmentName;

    private String equipmentType;

    private Long roomId;

    private String roomName;

    private Integer status = 1;

    private Boolean locked = false;

    private String description;
}
