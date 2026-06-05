package com.example.meetingroom.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchReservationResultDTO {

    private Integer totalCount;

    private Integer successCount;

    private Integer failCount;

    private List<ReservationDTO> successReservations;

    private List<BatchReservationFailItem> failItems;

    @Data
    public static class BatchReservationFailItem {

        private Integer index;

        private ReservationDTO reservation;

        private String errorMessage;

        public BatchReservationFailItem(Integer index, ReservationDTO reservation, String errorMessage) {
            this.index = index;
            this.reservation = reservation;
            this.errorMessage = errorMessage;
        }
    }
}
