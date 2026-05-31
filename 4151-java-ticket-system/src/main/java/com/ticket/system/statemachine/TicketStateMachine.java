package com.ticket.system.statemachine;

import com.ticket.system.entity.Ticket;
import com.ticket.system.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class TicketStateMachine {

    private final Map<Ticket.TicketStatus, Set<Ticket.TicketStatus>> transitionRules = new EnumMap<>(Ticket.TicketStatus.class);

    public TicketStateMachine() {
        initTransitionRules();
    }

    private void initTransitionRules() {
        addTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.PENDING_CONFIRM, Ticket.TicketStatus.IN_PROGRESS, Ticket.TicketStatus.CANCELLED);
        addTransition(Ticket.TicketStatus.PENDING_CONFIRM, Ticket.TicketStatus.IN_PROGRESS, Ticket.TicketStatus.CANCELLED);
        addTransition(Ticket.TicketStatus.IN_PROGRESS, Ticket.TicketStatus.PROCESSING, Ticket.TicketStatus.CANCELLED);
        addTransition(Ticket.TicketStatus.PROCESSING, Ticket.TicketStatus.PENDING_ACCEPTANCE, Ticket.TicketStatus.CANCELLED);
        addTransition(Ticket.TicketStatus.PENDING_ACCEPTANCE, Ticket.TicketStatus.CLOSED, Ticket.TicketStatus.PROCESSING);
        addTransition(Ticket.TicketStatus.CLOSED, Ticket.TicketStatus.PROCESSING);
        addTransition(Ticket.TicketStatus.CANCELLED);
    }

    private void addTransition(Ticket.TicketStatus from, Ticket.TicketStatus... to) {
        transitionRules.put(from, new HashSet<>(Arrays.asList(to)));
    }

    public boolean canTransition(Ticket.TicketStatus from, Ticket.TicketStatus to) {
        Set<Ticket.TicketStatus> allowedTransitions = transitionRules.get(from);
        return allowedTransitions != null && allowedTransitions.contains(to);
    }

    public void validateTransition(Ticket.TicketStatus from, Ticket.TicketStatus to) {
        if (!canTransition(from, to)) {
            throw new BusinessException("Invalid state transition: " + from + " -> " + to);
        }
    }

    public Set<Ticket.TicketStatus> getAllowedTransitions(Ticket.TicketStatus currentStatus) {
        return transitionRules.getOrDefault(currentStatus, Collections.emptySet());
    }

    public Ticket.TicketStatus transition(Ticket ticket, TicketStatusEvent event) {
        Ticket.TicketStatus currentStatus = ticket.getStatus();
        Ticket.TicketStatus targetStatus = getTargetStatus(currentStatus, event);
        
        validateTransition(currentStatus, targetStatus);
        log.info("Ticket {} state transition: {} -> {} (event: {})", 
                ticket.getTicketNo(), currentStatus, targetStatus, event);
        
        return targetStatus;
    }

    private Ticket.TicketStatus getTargetStatus(Ticket.TicketStatus currentStatus, TicketStatusEvent event) {
        return switch (event) {
            case CONFIRM -> Ticket.TicketStatus.PENDING_CONFIRM;
            case ACCEPT -> Ticket.TicketStatus.IN_PROGRESS;
            case START_PROCESSING -> Ticket.TicketStatus.PROCESSING;
            case SUBMIT_FOR_ACCEPTANCE -> Ticket.TicketStatus.PENDING_ACCEPTANCE;
            case ACCEPT_SOLUTION -> Ticket.TicketStatus.CLOSED;
            case REJECT_SOLUTION -> Ticket.TicketStatus.PROCESSING;
            case CANCEL -> Ticket.TicketStatus.CANCELLED;
            case REOPEN -> Ticket.TicketStatus.PROCESSING;
            default -> throw new BusinessException("Unsupported event: " + event);
        };
    }
}
