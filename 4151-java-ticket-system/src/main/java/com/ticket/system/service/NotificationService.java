package com.ticket.system.service;

import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketSlaLog;
import com.ticket.system.entity.TicketTransfer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class NotificationService {

    @Async
    public void sendTicketCreatedNotification(Ticket ticket) {
        log.info("Notification: Ticket {} created, notifying assignee and requester", ticket.getTicketNo());
    }

    @Async
    public void sendStatusChangeNotification(Ticket ticket, Ticket.TicketStatus oldStatus, Ticket.TicketStatus newStatus) {
        log.info("Notification: Ticket {} status changed from {} to {}, notifying relevant users", 
                ticket.getTicketNo(), oldStatus, newStatus);
    }

    @Async
    public void sendAssignmentNotification(Ticket ticket, Long oldAssigneeId, Long newAssigneeId) {
        log.info("Notification: Ticket {} assigned from user {} to user {}", 
                ticket.getTicketNo(), oldAssigneeId, newAssigneeId);
    }

    @Async
    public void sendTransferNotification(TicketTransfer transfer) {
        log.info("Notification: Ticket transfer requested for ticket {} from user {} to user {}", 
                transfer.getTicketId(), transfer.getFromUserId(), transfer.getToUserId());
    }

    @Async
    public void sendTransferConfirmationNotification(TicketTransfer transfer, boolean accepted) {
        log.info("Notification: Ticket transfer for ticket {} {} by user {}", 
                transfer.getTicketId(), accepted ? "accepted" : "rejected", transfer.getToUserId());
    }

    @Async
    public void sendCommentNotification(Ticket ticket, Long commentAuthorId) {
        log.info("Notification: New comment on ticket {} by user {}", ticket.getTicketNo(), commentAuthorId);
    }

    @Async
    public void sendSlaWarning(Ticket ticket, TicketSlaLog.SlaType slaType) {
        log.warn("Notification: SLA WARNING - Ticket {} is approaching {} SLA deadline", 
                ticket.getTicketNo(), slaType);
    }

    @Async
    public void sendEscalationNotification(Ticket ticket, int escalationLevel) {
        log.warn("Notification: Ticket {} has been escalated to level {}, notifying supervisors", 
                ticket.getTicketNo(), escalationLevel);
    }

    @Async
    public void sendTicketClosedNotification(Ticket ticket) {
        log.info("Notification: Ticket {} closed, sending satisfaction survey to requester", ticket.getTicketNo());
    }

    @Async
    public void sendSatisfactionInvitation(Ticket ticket) {
        log.info("Notification: Sending satisfaction survey invitation for ticket {}", ticket.getTicketNo());
    }

    @Async
    public void sendReminderNotification(Ticket ticket, int reminderCount) {
        log.info("Notification: Reminder #{} sent for ticket {}", reminderCount, ticket.getTicketNo());
    }
}
