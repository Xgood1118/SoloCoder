package com.ticket.system.service;

import com.ticket.system.dto.TicketStatisticsDTO;
import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketSlaLog;
import com.ticket.system.repository.TicketRepository;
import com.ticket.system.repository.TicketSlaLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final TicketRepository ticketRepository;
    private final TicketSlaLogRepository slaLogRepository;

    public TicketStatisticsDTO getOverallStatistics(LocalDateTime start, LocalDateTime end) {
        List<Ticket> tickets = ticketRepository.findByStatusInAndCreatedAtBetween(
                List.of(Ticket.TicketStatus.values()), start, end);

        return calculateStatistics(tickets, start, end);
    }

    public TicketStatisticsDTO getStatisticsByAssignee(Long assigneeId, LocalDateTime start, LocalDateTime end) {
        List<Ticket> tickets = ticketRepository.findByAssigneeIdAndStatusIn(assigneeId,
                List.of(Ticket.TicketStatus.values()));
        
        tickets = tickets.stream()
                .filter(t -> t.getCreatedAt().isAfter(start) && t.getCreatedAt().isBefore(end))
                .toList();

        TicketStatisticsDTO stats = calculateStatistics(tickets, start, end);
        stats.setGroupBy("assignee");
        stats.setGroupValue(String.valueOf(assigneeId));
        return stats;
    }

    public TicketStatisticsDTO getStatisticsByCategory(Long categoryId, LocalDateTime start, LocalDateTime end) {
        List<Ticket> tickets = ticketRepository.findByCategoryIdAndDeletedFalse(categoryId);
        
        tickets = tickets.stream()
                .filter(t -> t.getCreatedAt().isAfter(start) && t.getCreatedAt().isBefore(end))
                .toList();

        TicketStatisticsDTO stats = calculateStatistics(tickets, start, end);
        stats.setGroupBy("category");
        stats.setGroupValue(String.valueOf(categoryId));
        return stats;
    }

    private TicketStatisticsDTO calculateStatistics(List<Ticket> tickets, LocalDateTime start, LocalDateTime end) {
        long totalTickets = tickets.size();
        long newTickets = countByStatus(tickets, Ticket.TicketStatus.NEW);
        long inProgressTickets = countByStatus(tickets, Ticket.TicketStatus.IN_PROGRESS);
        long processingTickets = countByStatus(tickets, Ticket.TicketStatus.PROCESSING);
        long pendingAcceptanceTickets = countByStatus(tickets, Ticket.TicketStatus.PENDING_ACCEPTANCE);
        long closedTickets = countByStatus(tickets, Ticket.TicketStatus.CLOSED);
        long cancelledTickets = countByStatus(tickets, Ticket.TicketStatus.CANCELLED);

        long slaBreachedCount = tickets.stream()
                .filter(this::isSlaBreached)
                .count();

        double slaComplianceRate = totalTickets > 0 
                ? (double) (totalTickets - slaBreachedCount) / totalTickets * 100 
                : 100.0;

        double avgResponseTime = calculateAvgResponseTime(tickets);
        double avgResolutionTime = calculateAvgResolutionTime(tickets);

        List<Ticket> evaluatedTickets = tickets.stream()
                .filter(t -> t.getSatisfactionScore() != null)
                .toList();
        
        double avgSatisfaction = evaluatedTickets.stream()
                .mapToInt(Ticket::getSatisfactionScore)
                .average()
                .orElse(0.0);

        return TicketStatisticsDTO.builder()
                .totalTickets(totalTickets)
                .newTickets(newTickets)
                .inProgressTickets(inProgressTickets)
                .processingTickets(processingTickets)
                .pendingAcceptanceTickets(pendingAcceptanceTickets)
                .closedTickets(closedTickets)
                .cancelledTickets(cancelledTickets)
                .slaBreachedCount(slaBreachedCount)
                .slaComplianceRate(slaComplianceRate)
                .avgResponseTimeMinutes(avgResponseTime)
                .avgResolutionTimeMinutes(avgResolutionTime)
                .avgSatisfactionScore(avgSatisfaction)
                .satisfactionSurveyCount((long) evaluatedTickets.size())
                .periodStart(start)
                .periodEnd(end)
                .build();
    }

    private long countByStatus(List<Ticket> tickets, Ticket.TicketStatus status) {
        return tickets.stream()
                .filter(t -> t.getStatus() == status)
                .count();
    }

    private boolean isSlaBreached(Ticket ticket) {
        if (ticket.getResponseDueAt() == null) {
            return false;
        }
        
        LocalDateTime now = LocalDateTime.now();
        boolean responseBreached = ticket.getFirstResponseAt() == null && now.isAfter(ticket.getResponseDueAt());
        boolean resolutionBreached = ticket.getResolvedAt() == null && 
                ticket.getResolvedDueAt() != null && now.isAfter(ticket.getResolvedDueAt());
        
        return responseBreached || resolutionBreached;
    }

    private double calculateAvgResponseTime(List<Ticket> tickets) {
        List<Ticket> withResponse = tickets.stream()
                .filter(t -> t.getFirstResponseAt() != null)
                .toList();

        if (withResponse.isEmpty()) {
            return 0.0;
        }

        return withResponse.stream()
                .mapToLong(t -> Duration.between(t.getCreatedAt(), t.getFirstResponseAt()).toMinutes())
                .average()
                .orElse(0.0);
    }

    private double calculateAvgResolutionTime(List<Ticket> tickets) {
        List<Ticket> withResolution = tickets.stream()
                .filter(t -> t.getResolvedAt() != null)
                .toList();

        if (withResolution.isEmpty()) {
            return 0.0;
        }

        return withResolution.stream()
                .mapToLong(t -> Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes())
                .average()
                .orElse(0.0);
    }

    public long getSlaBreachCount(LocalDateTime start, LocalDateTime end) {
        List<TicketSlaLog> breaches = slaLogRepository.findByBreachedTrue();
        return breaches.stream()
                .filter(log -> log.getCreatedAt().isAfter(start) && log.getCreatedAt().isBefore(end))
                .count();
    }
}
