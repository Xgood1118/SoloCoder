package com.ecommerce.order.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogisticsInfo {
    private String trackingNumber;
    private String company;
    private String currentStatus;
    @Builder.Default
    private List<TrackingRecord> trackingRecords = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackingRecord {
        private LocalDateTime time;
        private String location;
        private String description;
    }

    public void addTrackingRecord(LocalDateTime time, String location, String description) {
        if (this.trackingRecords == null) {
            this.trackingRecords = new ArrayList<>();
        }
        this.trackingRecords.add(TrackingRecord.builder()
                .time(time)
                .location(location)
                .description(description)
                .build());
    }
}
