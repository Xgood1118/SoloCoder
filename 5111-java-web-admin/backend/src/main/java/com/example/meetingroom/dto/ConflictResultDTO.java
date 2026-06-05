package com.example.meetingroom.dto;

import lombok.Data;

import java.util.List;

@Data
public class ConflictResultDTO {

    private Boolean conflict;

    private String message;

    private List<ReservationDTO> conflictingReservations;

    public static ConflictResultDTO noConflict() {
        ConflictResultDTO result = new ConflictResultDTO();
        result.setConflict(false);
        result.setMessage("该时间段会议室可用");
        return result;
    }

    public static ConflictResultDTO hasConflict(List<ReservationDTO> reservations) {
        ConflictResultDTO result = new ConflictResultDTO();
        result.setConflict(true);
        result.setMessage("该时间段会议室已被预定");
        result.setConflictingReservations(reservations);
        return result;
    }
}
