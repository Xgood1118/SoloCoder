package com.ticket.system.service;

import com.ticket.system.config.SlaProperties;
import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketSlaLog;
import com.ticket.system.repository.TicketRepository;
import com.ticket.system.repository.TicketSlaLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SlaServiceTest {

    @Mock
    private SlaProperties slaProperties;

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private TicketSlaLogRepository ticketSlaLogRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private SlaService slaService;

    private void stubSlaProperties() {
        when(slaProperties.getResponseHoursByPriority(any())).thenAnswer(invocation -> {
            Ticket.Priority priority = invocation.getArgument(0);
            return switch (priority) {
                case URGENT -> 2;
                case IMPORTANT -> 4;
                case NORMAL -> 8;
                case LOW -> 24;
            };
        });
    }

    @Test
    void testCalculateSla_UrgentPriority() {
        stubSlaProperties();

        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setPriority(Ticket.Priority.URGENT);
        ticket.setCreatedAt(LocalDateTime.now());

        slaService.calculateSla(ticket);

        assertNotNull(ticket.getResponseDueAt());
        assertNotNull(ticket.getResolvedDueAt());
        
        LocalDateTime expectedResponseDue = ticket.getCreatedAt().plusHours(2);
        assertEquals(expectedResponseDue.getHour(), ticket.getResponseDueAt().getHour());
        
        verify(ticketSlaLogRepository, times(2)).save(any(TicketSlaLog.class));
    }

    @Test
    void testCalculateSla_NormalPriority() {
        stubSlaProperties();

        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setPriority(Ticket.Priority.NORMAL);
        ticket.setCreatedAt(LocalDateTime.now());

        slaService.calculateSla(ticket);

        LocalDateTime expectedResponseDue = ticket.getCreatedAt().plusHours(8);
        assertEquals(expectedResponseDue.getHour(), ticket.getResponseDueAt().getHour());
    }

    @Test
    void testMarkResponseComplete() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");

        when(ticketSlaLogRepository.findByTicketIdAndSlaType(anyLong(), any())).thenReturn(Collections.emptyList());

        slaService.markResponseComplete(ticket);

        assertNotNull(ticket.getFirstResponseAt());
    }

    @Test
    void testMarkResolutionComplete() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");

        when(ticketSlaLogRepository.findByTicketIdAndSlaType(anyLong(), any())).thenReturn(Collections.emptyList());

        slaService.markResolutionComplete(ticket);

        assertNotNull(ticket.getResolvedAt());
    }

    @Test
    void testIsSlaBreached_ResponseBreached() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setResponseDueAt(LocalDateTime.now().minusHours(1));
        ticket.setFirstResponseAt(null);

        boolean breached = slaService.isSlaBreached(ticket);

        assertTrue(breached);
    }

    @Test
    void testIsSlaBreached_NotBreached() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setResponseDueAt(LocalDateTime.now().plusHours(1));
        ticket.setFirstResponseAt(null);

        boolean breached = slaService.isSlaBreached(ticket);

        assertFalse(breached);
    }

    @Test
    void testIsSlaBreached_AlreadyResponded() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setResponseDueAt(LocalDateTime.now().minusHours(1));
        ticket.setFirstResponseAt(LocalDateTime.now().minusHours(2));
        ticket.setResolvedDueAt(LocalDateTime.now().plusHours(5));

        boolean breached = slaService.isSlaBreached(ticket);

        assertFalse(breached);
    }

    @Test
    void testEscalateTicket_FirstLevel() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setEscalationLevel(0);

        when(ticketRepository.save(any(Ticket.class))).thenReturn(ticket);

        slaService.escalateTicket(ticket);

        assertEquals(1, ticket.getEscalationLevel());
        verify(notificationService, times(1)).sendEscalationNotification(any(), eq(1));
    }

    @Test
    void testEscalateTicket_MaxLevelReached() {
        Ticket ticket = new Ticket();
        ticket.setId(1L);
        ticket.setTicketNo("TK001");
        ticket.setEscalationLevel(2);

        slaService.escalateTicket(ticket);

        assertEquals(2, ticket.getEscalationLevel());
        verify(ticketRepository, never()).save(any());
        verify(notificationService, never()).sendEscalationNotification(any(), anyInt());
    }
}
