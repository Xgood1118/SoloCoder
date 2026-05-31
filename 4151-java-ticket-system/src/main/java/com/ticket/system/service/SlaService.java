package com.ticket.system.service;

import com.ticket.system.config.SlaProperties;
import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketSlaLog;
import com.ticket.system.repository.TicketRepository;
import com.ticket.system.repository.TicketSlaLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SlaService {

    private final SlaProperties slaProperties;
    private final TicketRepository ticketRepository;
    private final TicketSlaLogRepository ticketSlaLogRepository;
    private final NotificationService notificationService;

    @Transactional
    public void calculateSla(Ticket ticket) {
        LocalDateTime createdAt = ticket.getCreatedAt();
        int responseHours = slaProperties.getResponseHoursByPriority(ticket.getPriority());
        
        LocalDateTime responseDueAt = createdAt.plusHours(responseHours);
        LocalDateTime resolvedDueAt = createdAt.plusHours(responseHours * 3);
        
        ticket.setResponseDueAt(responseDueAt);
        ticket.setResolvedDueAt(resolvedDueAt);
        
        createSlaLog(ticket, TicketSlaLog.SlaType.RESPONSE_TIME, responseDueAt);
        createSlaLog(ticket, TicketSlaLog.SlaType.RESOLUTION_TIME, resolvedDueAt);
        
        log.info("SLA calculated for ticket {}: response due at {}, resolved due at {}", 
                ticket.getTicketNo(), responseDueAt, resolvedDueAt);
    }

    private void createSlaLog(Ticket ticket, TicketSlaLog.SlaType slaType, LocalDateTime dueAt) {
        TicketSlaLog slaLog = new TicketSlaLog();
        slaLog.setTicketId(ticket.getId());
        slaLog.setSlaType(slaType);
        slaLog.setDueAt(dueAt);
        slaLog.setBreached(false);
        ticketSlaLogRepository.save(slaLog);
    }

    public void markResponseComplete(Ticket ticket) {
        ticket.setFirstResponseAt(LocalDateTime.now());
        updateSlaLog(ticket.getId(), TicketSlaLog.SlaType.RESPONSE_TIME);
    }

    public void markResolutionComplete(Ticket ticket) {
        ticket.setResolvedAt(LocalDateTime.now());
        updateSlaLog(ticket.getId(), TicketSlaLog.SlaType.RESOLUTION_TIME);
    }

    @Transactional
    public void updateSlaLog(Long ticketId, TicketSlaLog.SlaType slaType) {
        List<TicketSlaLog> logs = ticketSlaLogRepository.findByTicketIdAndSlaType(ticketId, slaType);
        if (!logs.isEmpty()) {
            TicketSlaLog log = logs.get(0);
            log.setActualAt(LocalDateTime.now());
            log.setBreached(log.getActualAt().isAfter(log.getDueAt()));
            
            if (log.getBreached()) {
                long breachMinutes = Duration.between(log.getDueAt(), log.getActualAt()).toMinutes();
                log.setBreachDurationMinutes(breachMinutes);
            }
            
            ticketSlaLogRepository.save(log);
        }
    }

    @Scheduled(fixedRate = 60000, initialDelay = 30000)
    public void checkSlaWarnings() {
        LocalDateTime now = LocalDateTime.now();
        List<Ticket> activeTickets = ticketRepository.findByStatusInAndDeletedFalse(
            List.of(Ticket.TicketStatus.NEW, Ticket.TicketStatus.IN_PROGRESS, 
                    Ticket.TicketStatus.PROCESSING, Ticket.TicketStatus.PENDING_CONFIRM)
        );

        for (Ticket ticket : activeTickets) {
            checkResponseSla(ticket, now);
            checkResolutionSla(ticket, now);
        }
    }

    private void checkResponseSla(Ticket ticket, LocalDateTime now) {
        if (ticket.getFirstResponseAt() != null) {
            return;
        }

        LocalDateTime responseDueAt = ticket.getResponseDueAt();
        if (responseDueAt == null) {
            return;
        }

        long minutesUntilDue = Duration.between(now, responseDueAt).toMinutes();
        
        if (minutesUntilDue <= slaProperties.getWarningThresholdMinutes() && minutesUntilDue > 0) {
            sendSlaWarningIfNeeded(ticket, TicketSlaLog.SlaType.RESPONSE_TIME, now);
        }
        
        if (now.isAfter(responseDueAt)) {
            escalateTicket(ticket);
        }
    }

    private void checkResolutionSla(Ticket ticket, LocalDateTime now) {
        if (ticket.getResolvedAt() != null) {
            return;
        }

        LocalDateTime resolvedDueAt = ticket.getResolvedDueAt();
        if (resolvedDueAt == null) {
            return;
        }

        long minutesUntilDue = Duration.between(now, resolvedDueAt).toMinutes();
        
        if (minutesUntilDue <= slaProperties.getWarningThresholdMinutes() && minutesUntilDue > 0) {
            sendSlaWarningIfNeeded(ticket, TicketSlaLog.SlaType.RESOLUTION_TIME, now);
        }
        
        if (now.isAfter(resolvedDueAt)) {
            escalateTicket(ticket);
        }
    }

    @Transactional
    public void sendSlaWarningIfNeeded(Ticket ticket, TicketSlaLog.SlaType slaType, LocalDateTime now) {
        List<TicketSlaLog> logs = ticketSlaLogRepository.findByTicketIdAndSlaType(ticket.getId(), slaType);
        if (!logs.isEmpty() && !logs.get(0).getWarningSent()) {
            logs.get(0).setWarningSent(true);
            logs.get(0).setWarningSentAt(now);
            ticketSlaLogRepository.save(logs.get(0));
            notificationService.sendSlaWarning(ticket, slaType);
        }
    }

    @Transactional
    public void escalateTicket(Ticket ticket) {
        int newLevel = ticket.getEscalationLevel() + 1;
        if (newLevel > 2) {
            return;
        }
        
        ticket.setEscalationLevel(newLevel);
        ticketRepository.save(ticket);
        
        notificationService.sendEscalationNotification(ticket, newLevel);
        log.warn("Ticket {} escalated to level {}", ticket.getTicketNo(), newLevel);
    }

    public boolean isSlaBreached(Ticket ticket) {
        if (ticket.getResponseDueAt() == null) {
            return false;
        }
        
        LocalDateTime now = LocalDateTime.now();
        boolean responseBreached = ticket.getFirstResponseAt() == null && now.isAfter(ticket.getResponseDueAt());
        boolean resolutionBreached = ticket.getResolvedAt() == null && 
                ticket.getResolvedDueAt() != null && now.isAfter(ticket.getResolvedDueAt());
        
        return responseBreached || resolutionBreached;
    }
}
