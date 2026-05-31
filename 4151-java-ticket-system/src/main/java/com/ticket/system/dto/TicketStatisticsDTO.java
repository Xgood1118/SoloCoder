package com.ticket.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatisticsDTO {

    private Long totalTickets;
    private Long newTickets;
    private Long inProgressTickets;
    private Long processingTickets;
    private Long pendingAcceptanceTickets;
    private Long closedTickets;
    private Long cancelledTickets;

    private Long slaBreachedCount;
    private Double slaComplianceRate;

    private Double avgResponseTimeMinutes;
    private Double avgResolutionTimeMinutes;

    private Double avgSatisfactionScore;
    private Long satisfactionSurveyCount;

    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;

    private String groupBy;
    private String groupValue;
}
