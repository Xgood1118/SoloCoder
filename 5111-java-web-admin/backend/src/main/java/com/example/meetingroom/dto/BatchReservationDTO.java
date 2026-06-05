package com.example.meetingroom.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BatchReservationDTO {

    @NotEmpty(message = "预定列表不能为空")
    @Valid
    private List<ReservationDTO> reservations;

    private String operator;
}
