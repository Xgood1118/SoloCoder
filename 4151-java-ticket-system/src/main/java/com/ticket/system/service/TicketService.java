package com.ticket.system.service;

import com.ticket.system.entity.*;
import com.ticket.system.exception.BusinessException;
import com.ticket.system.repository.*;
import com.ticket.system.statemachine.TicketStateMachine;
import com.ticket.system.statemachine.TicketStatusEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketStateMachine stateMachine;
    private final SlaService slaService;
    private final TicketAssignmentService assignmentService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final TicketCategoryRepository categoryRepository;
    private final TicketTransferRepository transferRepository;
    private final TicketTemplateRepository templateRepository;

    private final AtomicInteger ticketCounter = new AtomicInteger(0);

    @Transactional
    public Ticket createTicket(Ticket ticket) {
        validateTicket(ticket);

        ticket.setTicketNo(generateTicketNo());
        ticket.setStatus(Ticket.TicketStatus.NEW);
        ticket.setReminderCount(0);
        ticket.setEscalationLevel(0);

        applyTemplateIfNeeded(ticket);
        assignDefaultValues(ticket);

        Ticket savedTicket = ticketRepository.save(ticket);

        slaService.calculateSla(savedTicket);
        assignmentService.autoAssign(savedTicket);

        log.info("Ticket created successfully: {}", savedTicket.getTicketNo());
        notificationService.sendTicketCreatedNotification(savedTicket);

        return savedTicket;
    }

    private String generateTicketNo() {
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int sequence = ticketCounter.incrementAndGet();
        return String.format("TK%s%06d", datePart, sequence);
    }

    private void validateTicket(Ticket ticket) {
        if (ticket.getTitle() == null || ticket.getTitle().trim().isEmpty()) {
            throw new BusinessException("Ticket title cannot be empty");
        }
        if (ticket.getCategoryId() == null) {
            throw new BusinessException("Ticket category is required");
        }
        if (!categoryRepository.existsById(ticket.getCategoryId())) {
            throw new BusinessException("Invalid category ID: " + ticket.getCategoryId());
        }
        if (ticket.getRequesterId() == null) {
            throw new BusinessException("Requester is required");
        }
        if (!userRepository.existsById(ticket.getRequesterId())) {
            throw new BusinessException("Invalid requester ID: " + ticket.getRequesterId());
        }
        if (ticket.getPriority() == null) {
            ticket.setPriority(Ticket.Priority.NORMAL);
        }
        if (ticket.getSource() == null) {
            ticket.setSource(Ticket.Source.WEB_PORTAL);
        }
    }

    private void applyTemplateIfNeeded(Ticket ticket) {
        if (ticket.getTemplateId() != null) {
            templateRepository.findById(ticket.getTemplateId()).ifPresent(template -> {
                if (ticket.getTitle() == null || ticket.getTitle().isEmpty()) {
                    ticket.setTitle(template.getPredefinedTitle());
                }
                if (ticket.getDescription() == null || ticket.getDescription().isEmpty()) {
                    ticket.setDescription(template.getPredefinedDescription());
                }
                if (ticket.getPriority() == null && template.getDefaultPriority() != null) {
                    ticket.setPriority(template.getDefaultPriority());
                }
                if (ticket.getAssigneeId() == null && template.getDefaultAssigneeId() != null) {
                    ticket.setAssigneeId(template.getDefaultAssigneeId());
                }
                if (ticket.getDepartmentId() == null && template.getDefaultDepartmentId() != null) {
                    ticket.setDepartmentId(template.getDefaultDepartmentId());
                }
            });
        }
    }

    private void assignDefaultValues(Ticket ticket) {
        if (ticket.getAssigneeId() == null) {
            categoryRepository.findById(ticket.getCategoryId()).ifPresent(category -> {
                if (category.getDefaultAssigneeId() != null) {
                    ticket.setAssigneeId(category.getDefaultAssigneeId());
                }
                if (category.getDefaultDepartmentId() != null) {
                    ticket.setDepartmentId(category.getDefaultDepartmentId());
                }
            });
        }
    }

    @Transactional
    public Ticket updateStatus(Long ticketId, TicketStatusEvent event, Long operatorId) {
        Ticket ticket = getTicketById(ticketId);
        Ticket.TicketStatus oldStatus = ticket.getStatus();
        
        Ticket.TicketStatus newStatus = stateMachine.transition(ticket, event);
        ticket.setStatus(newStatus);
        ticket.setUpdatedBy(operatorId);

        handleStatusChange(ticket, oldStatus, newStatus);

        Ticket savedTicket = ticketRepository.save(ticket);
        notificationService.sendStatusChangeNotification(savedTicket, oldStatus, newStatus);

        return savedTicket;
    }

    private void handleStatusChange(Ticket ticket, Ticket.TicketStatus oldStatus, Ticket.TicketStatus newStatus) {
        switch (newStatus) {
            case IN_PROGRESS:
                if (ticket.getFirstResponseAt() == null) {
                    slaService.markResponseComplete(ticket);
                }
                break;
            case PENDING_ACCEPTANCE:
                slaService.markResolutionComplete(ticket);
                break;
            case CLOSED:
                ticket.setClosedAt(LocalDateTime.now());
                notificationService.sendTicketClosedNotification(ticket);
                notificationService.sendSatisfactionInvitation(ticket);
                break;
            default:
                break;
        }
    }

    @Transactional
    public Ticket assignTicket(Long ticketId, Long assigneeId, Long assignerId) {
        Ticket ticket = getTicketById(ticketId);
        Long oldAssigneeId = ticket.getAssigneeId();

        if (!userRepository.existsById(assigneeId)) {
            throw new BusinessException("Invalid assignee ID: " + assigneeId);
        }

        ticket.setAssigneeId(assigneeId);
        ticket.setUpdatedBy(assignerId);
        
        Ticket savedTicket = ticketRepository.save(ticket);
        notificationService.sendAssignmentNotification(savedTicket, oldAssigneeId, assigneeId);

        log.info("Ticket {} assigned from {} to {}", ticketId, oldAssigneeId, assigneeId);
        return savedTicket;
    }

    @Transactional
    public TicketTransfer transferTicket(Long ticketId, Long fromUserId, Long toUserId, String reason) {
        Ticket ticket = getTicketById(ticketId);
        
        if (!userRepository.existsById(toUserId)) {
            throw new BusinessException("Invalid target user ID: " + toUserId);
        }
        
        if (reason == null || reason.trim().isEmpty()) {
            throw new BusinessException("Transfer reason is required");
        }

        User fromUser = userRepository.findById(fromUserId)
                .orElseThrow(() -> new BusinessException("Invalid user ID: " + fromUserId));
        User toUser = userRepository.findById(toUserId).orElseThrow();

        TicketTransfer transfer = new TicketTransfer();
        transfer.setTicketId(ticketId);
        transfer.setFromUserId(fromUserId);
        transfer.setToUserId(toUserId);
        transfer.setFromDepartmentId(fromUser.getDepartmentId());
        transfer.setToDepartmentId(toUser.getDepartmentId());
        transfer.setReason(reason);
        transfer.setStatus(TicketTransfer.TransferStatus.PENDING);

        TicketTransfer savedTransfer = transferRepository.save(transfer);
        notificationService.sendTransferNotification(savedTransfer);

        log.info("Ticket {} transfer requested from {} to {}", ticketId, fromUserId, toUserId);
        return savedTransfer;
    }

    @Transactional
    public TicketTransfer confirmTransfer(Long transferId, Long userId, boolean accepted, String remark) {
        TicketTransfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new BusinessException("Transfer not found: " + transferId));

        if (!transfer.getToUserId().equals(userId)) {
            throw new BusinessException("Only the target user can confirm the transfer");
        }

        if (transfer.getStatus() != TicketTransfer.TransferStatus.PENDING) {
            throw new BusinessException("Transfer is not in pending status");
        }

        transfer.setStatus(accepted ? TicketTransfer.TransferStatus.ACCEPTED : TicketTransfer.TransferStatus.REJECTED);
        transfer.setConfirmedAt(LocalDateTime.now());
        transfer.setConfirmRemark(remark);

        if (accepted) {
            Ticket ticket = getTicketById(transfer.getTicketId());
            ticket.setAssigneeId(transfer.getToUserId());
            ticket.setDepartmentId(transfer.getToDepartmentId());
            ticketRepository.save(ticket);
        }

        TicketTransfer savedTransfer = transferRepository.save(transfer);
        notificationService.sendTransferConfirmationNotification(savedTransfer, accepted);

        return savedTransfer;
    }

    @Transactional
    public Ticket remindTicket(Long ticketId, Long reminderUserId) {
        Ticket ticket = getTicketById(ticketId);

        if (ticket.getStatus() == Ticket.TicketStatus.CLOSED || 
            ticket.getStatus() == Ticket.TicketStatus.CANCELLED) {
            throw new BusinessException("Cannot remind a closed/cancelled ticket");
        }

        int newCount = ticket.getReminderCount() + 1;
        ticket.setReminderCount(newCount);

        if (newCount >= 3) {
            slaService.escalateTicket(ticket);
        }

        Ticket savedTicket = ticketRepository.save(ticket);
        notificationService.sendReminderNotification(savedTicket, newCount);

        log.info("Ticket {} reminded, count: {}", ticketId, newCount);
        return savedTicket;
    }

    @Transactional
    public Ticket submitSolution(Long ticketId, String solution, Long operatorId) {
        Ticket ticket = getTicketById(ticketId);

        if (ticket.getStatus() != Ticket.TicketStatus.PROCESSING) {
            throw new BusinessException("Solution can only be submitted in PROCESSING status");
        }

        if (solution == null || solution.trim().isEmpty()) {
            throw new BusinessException("Solution cannot be empty");
        }

        ticket.setSolution(solution);
        ticket.setUpdatedBy(operatorId);
        
        return updateStatus(ticketId, TicketStatusEvent.SUBMIT_FOR_ACCEPTANCE, operatorId);
    }

    @Transactional
    public Ticket acceptSolution(Long ticketId, Long operatorId) {
        return updateStatus(ticketId, TicketStatusEvent.ACCEPT_SOLUTION, operatorId);
    }

    @Transactional
    public Ticket rejectSolution(Long ticketId, String reason, Long operatorId) {
        Ticket ticket = updateStatus(ticketId, TicketStatusEvent.REJECT_SOLUTION, operatorId);
        log.info("Ticket {} solution rejected: {}", ticketId, reason);
        return ticket;
    }

    @Transactional
    public Ticket cancelTicket(Long ticketId, String reason, Long operatorId) {
        return updateStatus(ticketId, TicketStatusEvent.CANCEL, operatorId);
    }

    public Ticket getTicketById(Long ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new BusinessException("Ticket not found: " + ticketId));
    }

    public Optional<Ticket> findByTicketNo(String ticketNo) {
        return ticketRepository.findByTicketNo(ticketNo);
    }

    public Page<Ticket> findTickets(Specification<Ticket> spec, Pageable pageable) {
        return ticketRepository.findAll(spec, pageable);
    }

    public List<Ticket> getTicketsByRequester(Long requesterId) {
        return ticketRepository.findByRequesterIdAndDeletedFalse(requesterId);
    }

    public List<Ticket> getTicketsByAssignee(Long assigneeId) {
        return ticketRepository.findByAssigneeIdAndDeletedFalse(assigneeId);
    }

    @Transactional
    public Ticket evaluateSatisfaction(Long ticketId, Integer score, String comment) {
        Ticket ticket = getTicketById(ticketId);

        if (ticket.getStatus() != Ticket.TicketStatus.CLOSED) {
            throw new BusinessException("Only closed tickets can be evaluated");
        }

        if (score < 1 || score > 5) {
            throw new BusinessException("Satisfaction score must be between 1 and 5");
        }

        ticket.setSatisfactionScore(score);
        ticket.setSatisfactionComment(comment);

        if (score <= 2) {
            ticket.setNeedsReview(true);
            log.warn("Ticket {} received low satisfaction score: {}", ticketId, score);
        }

        return ticketRepository.save(ticket);
    }

    @Transactional
    public Ticket reopenTicket(Long ticketId, String reason, Long operatorId) {
        Ticket ticket = getTicketById(ticketId);

        if (ticket.getStatus() != Ticket.TicketStatus.CLOSED) {
            throw new BusinessException("Only closed tickets can be reopened");
        }

        Ticket.TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(Ticket.TicketStatus.PROCESSING);
        ticket.setUpdatedBy(operatorId);
        ticket.setClosedAt(null);

        Ticket savedTicket = ticketRepository.save(ticket);
        notificationService.sendStatusChangeNotification(savedTicket, oldStatus, Ticket.TicketStatus.PROCESSING);

        log.info("Ticket {} reopened: {}", ticketId, reason);
        return savedTicket;
    }
}
