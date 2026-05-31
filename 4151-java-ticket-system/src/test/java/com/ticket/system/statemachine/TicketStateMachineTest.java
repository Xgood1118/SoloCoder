package com.ticket.system.statemachine;

import com.ticket.system.entity.Ticket;
import com.ticket.system.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class TicketStateMachineTest {

    private TicketStateMachine stateMachine;

    @BeforeEach
    void setUp() {
        stateMachine = new TicketStateMachine();
    }

    @Test
    void testValidTransitionFromNew() {
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.PENDING_CONFIRM));
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.IN_PROGRESS));
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.CANCELLED));
    }

    @Test
    void testInvalidTransitionFromNew() {
        assertFalse(stateMachine.canTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.PROCESSING));
        assertFalse(stateMachine.canTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.PENDING_ACCEPTANCE));
        assertFalse(stateMachine.canTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.CLOSED));
    }

    @Test
    void testValidTransitionFromProcessing() {
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.PROCESSING, Ticket.TicketStatus.PENDING_ACCEPTANCE));
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.PROCESSING, Ticket.TicketStatus.CANCELLED));
    }

    @Test
    void testValidTransitionFromPendingAcceptance() {
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.PENDING_ACCEPTANCE, Ticket.TicketStatus.CLOSED));
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.PENDING_ACCEPTANCE, Ticket.TicketStatus.PROCESSING));
    }

    @Test
    void testValidTransitionFromClosed() {
        assertTrue(stateMachine.canTransition(Ticket.TicketStatus.CLOSED, Ticket.TicketStatus.PROCESSING));
    }

    @Test
    void testNoTransitionFromCancelled() {
        Set<Ticket.TicketStatus> allowed = stateMachine.getAllowedTransitions(Ticket.TicketStatus.CANCELLED);
        assertTrue(allowed.isEmpty());
    }

    @Test
    void testValidateTransition_Valid() {
        assertDoesNotThrow(() -> 
            stateMachine.validateTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.IN_PROGRESS));
    }

    @Test
    void testValidateTransition_Invalid() {
        BusinessException exception = assertThrows(BusinessException.class, () ->
            stateMachine.validateTransition(Ticket.TicketStatus.NEW, Ticket.TicketStatus.CLOSED));
        assertTrue(exception.getMessage().contains("Invalid state transition"));
    }

    @Test
    void testTransitionWithEvent_AcceptFromNew() {
        Ticket ticket = new Ticket();
        ticket.setStatus(Ticket.TicketStatus.NEW);
        ticket.setTicketNo("TK001");

        Ticket.TicketStatus newStatus = stateMachine.transition(ticket, TicketStatusEvent.ACCEPT);
        assertEquals(Ticket.TicketStatus.IN_PROGRESS, newStatus);
    }

    @Test
    void testTransitionWithEvent_SubmitForAcceptance() {
        Ticket ticket = new Ticket();
        ticket.setStatus(Ticket.TicketStatus.PROCESSING);
        ticket.setTicketNo("TK001");

        Ticket.TicketStatus newStatus = stateMachine.transition(ticket, TicketStatusEvent.SUBMIT_FOR_ACCEPTANCE);
        assertEquals(Ticket.TicketStatus.PENDING_ACCEPTANCE, newStatus);
    }

    @Test
    void testTransitionWithEvent_AcceptSolution() {
        Ticket ticket = new Ticket();
        ticket.setStatus(Ticket.TicketStatus.PENDING_ACCEPTANCE);
        ticket.setTicketNo("TK001");

        Ticket.TicketStatus newStatus = stateMachine.transition(ticket, TicketStatusEvent.ACCEPT_SOLUTION);
        assertEquals(Ticket.TicketStatus.CLOSED, newStatus);
    }

    @Test
    void testTransitionWithEvent_Reopen() {
        Ticket ticket = new Ticket();
        ticket.setStatus(Ticket.TicketStatus.CLOSED);
        ticket.setTicketNo("TK001");

        Ticket.TicketStatus newStatus = stateMachine.transition(ticket, TicketStatusEvent.REOPEN);
        assertEquals(Ticket.TicketStatus.PROCESSING, newStatus);
    }

    @Test
    void testTransitionWithEvent_InvalidEvent() {
        Ticket ticket = new Ticket();
        ticket.setStatus(Ticket.TicketStatus.NEW);
        ticket.setTicketNo("TK001");

        BusinessException exception = assertThrows(BusinessException.class, () ->
            stateMachine.transition(ticket, TicketStatusEvent.ACCEPT_SOLUTION));
        assertTrue(exception.getMessage().contains("Invalid state transition"));
    }
}
