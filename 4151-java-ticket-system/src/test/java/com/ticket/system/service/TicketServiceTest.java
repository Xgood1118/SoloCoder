package com.ticket.system.service;

import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketCategory;
import com.ticket.system.entity.User;
import com.ticket.system.exception.BusinessException;
import com.ticket.system.repository.*;
import com.ticket.system.statemachine.TicketStateMachine;
import com.ticket.system.statemachine.TicketStatusEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketServiceTest {

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private TicketStateMachine stateMachine;

    @Mock
    private SlaService slaService;

    @Mock
    private TicketAssignmentService assignmentService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TicketCategoryRepository categoryRepository;

    @Mock
    private TicketTransferRepository transferRepository;

    @Mock
    private TicketTemplateRepository templateRepository;

    @InjectMocks
    private TicketService ticketService;

    private Ticket testTicket;
    private User testUser;
    private TicketCategory testCategory;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("testuser");

        testCategory = new TicketCategory();
        testCategory.setId(1L);
        testCategory.setName("技术问题");

        testTicket = new Ticket();
        testTicket.setId(1L);
        testTicket.setTicketNo("TK20240101000001");
        testTicket.setTitle("测试工单");
        testTicket.setDescription("测试描述");
        testTicket.setCategoryId(1L);
        testTicket.setRequesterId(1L);
        testTicket.setStatus(Ticket.TicketStatus.NEW);
        testTicket.setPriority(Ticket.Priority.NORMAL);
        testTicket.setSource(Ticket.Source.WEB_PORTAL);
        testTicket.setCreatedAt(LocalDateTime.now());
    }

    @Test
    void testCreateTicket_Success() {
        when(userRepository.existsById(1L)).thenReturn(true);
        when(categoryRepository.existsById(1L)).thenReturn(true);
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(testCategory));
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.createTicket(testTicket);

        assertNotNull(result);
        assertEquals(Ticket.TicketStatus.NEW, result.getStatus());
        assertNotNull(result.getTicketNo());
        
        verify(slaService, times(1)).calculateSla(any(Ticket.class));
        verify(assignmentService, times(1)).autoAssign(any(Ticket.class));
        verify(notificationService, times(1)).sendTicketCreatedNotification(any());
    }

    @Test
    void testCreateTicket_EmptyTitle() {
        testTicket.setTitle("");

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.createTicket(testTicket));
        
        assertTrue(exception.getMessage().contains("title cannot be empty"));
    }

    @Test
    void testCreateTicket_NullCategory() {
        testTicket.setCategoryId(null);

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.createTicket(testTicket));
        
        assertTrue(exception.getMessage().contains("category is required"));
    }

    @Test
    void testCreateTicket_InvalidCategory() {
        when(categoryRepository.existsById(999L)).thenReturn(false);
        testTicket.setCategoryId(999L);

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.createTicket(testTicket));
        
        assertTrue(exception.getMessage().contains("Invalid category ID"));
    }

    @Test
    void testUpdateStatus_Success() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(stateMachine.transition(any(Ticket.class), eq(TicketStatusEvent.ACCEPT)))
                .thenReturn(Ticket.TicketStatus.IN_PROGRESS);
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.updateStatus(1L, TicketStatusEvent.ACCEPT, 1L);

        assertNotNull(result);
        verify(stateMachine, times(1)).transition(any(), eq(TicketStatusEvent.ACCEPT));
        verify(notificationService, times(1)).sendStatusChangeNotification(any(), any(), any());
    }

    @Test
    void testUpdateStatus_TicketNotFound() {
        when(ticketRepository.findById(999L)).thenReturn(Optional.empty());

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.updateStatus(999L, TicketStatusEvent.ACCEPT, 1L));
        
        assertTrue(exception.getMessage().contains("Ticket not found"));
    }

    @Test
    void testAssignTicket_Success() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(userRepository.existsById(2L)).thenReturn(true);
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.assignTicket(1L, 2L, 1L);

        assertNotNull(result);
        verify(notificationService, times(1)).sendAssignmentNotification(any(), any(), any());
    }

    @Test
    void testAssignTicket_InvalidAssignee() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(userRepository.existsById(999L)).thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.assignTicket(1L, 999L, 1L));
        
        assertTrue(exception.getMessage().contains("Invalid assignee ID"));
    }

    @Test
    void testRemindTicket_Success() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.remindTicket(1L, 1L);

        assertNotNull(result);
        assertEquals(1, testTicket.getReminderCount());
        verify(notificationService, times(1)).sendReminderNotification(any(), eq(1));
    }

    @Test
    void testRemindTicket_ClosedTicket() {
        testTicket.setStatus(Ticket.TicketStatus.CLOSED);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.remindTicket(1L, 1L));
        
        assertTrue(exception.getMessage().contains("Cannot remind a closed"));
    }

    @Test
    void testSubmitSolution_Success() {
        testTicket.setStatus(Ticket.TicketStatus.PROCESSING);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(stateMachine.transition(any(Ticket.class), eq(TicketStatusEvent.SUBMIT_FOR_ACCEPTANCE)))
                .thenReturn(Ticket.TicketStatus.PENDING_ACCEPTANCE);
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.submitSolution(1L, "问题已解决", 1L);

        assertNotNull(result);
        assertEquals("问题已解决", testTicket.getSolution());
    }

    @Test
    void testSubmitSolution_WrongStatus() {
        testTicket.setStatus(Ticket.TicketStatus.NEW);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.submitSolution(1L, "问题已解决", 1L));
        
        assertTrue(exception.getMessage().contains("Solution can only be submitted in PROCESSING"));
    }

    @Test
    void testSubmitSolution_EmptySolution() {
        testTicket.setStatus(Ticket.TicketStatus.PROCESSING);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.submitSolution(1L, "", 1L));
        
        assertTrue(exception.getMessage().contains("Solution cannot be empty"));
    }

    @Test
    void testEvaluateSatisfaction_Success() {
        testTicket.setStatus(Ticket.TicketStatus.CLOSED);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.evaluateSatisfaction(1L, 5, "非常满意");

        assertNotNull(result);
        assertEquals(5, testTicket.getSatisfactionScore());
        assertEquals("非常满意", testTicket.getSatisfactionComment());
    }

    @Test
    void testEvaluateSatisfaction_NotClosed() {
        testTicket.setStatus(Ticket.TicketStatus.PROCESSING);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.evaluateSatisfaction(1L, 5, "非常满意"));
        
        assertTrue(exception.getMessage().contains("Only closed tickets can be evaluated"));
    }

    @Test
    void testEvaluateSatisfaction_InvalidScore() {
        testTicket.setStatus(Ticket.TicketStatus.CLOSED);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.evaluateSatisfaction(1L, 6, "test"));
        
        assertTrue(exception.getMessage().contains("must be between 1 and 5"));
    }

    @Test
    void testReopenTicket_Success() {
        testTicket.setStatus(Ticket.TicketStatus.CLOSED);
        testTicket.setClosedAt(LocalDateTime.now());
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));
        when(ticketRepository.save(any(Ticket.class))).thenReturn(testTicket);

        Ticket result = ticketService.reopenTicket(1L, "问题未解决", 1L);

        assertNotNull(result);
        assertEquals(Ticket.TicketStatus.PROCESSING, testTicket.getStatus());
        assertNull(testTicket.getClosedAt());
    }

    @Test
    void testReopenTicket_NotClosed() {
        testTicket.setStatus(Ticket.TicketStatus.PROCESSING);
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.reopenTicket(1L, "问题未解决", 1L));
        
        assertTrue(exception.getMessage().contains("Only closed tickets can be reopened"));
    }

    @Test
    void testGetTicketById_Success() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(testTicket));

        Ticket result = ticketService.getTicketById(1L);

        assertNotNull(result);
        assertEquals("TK20240101000001", result.getTicketNo());
    }

    @Test
    void testGetTicketById_NotFound() {
        when(ticketRepository.findById(999L)).thenReturn(Optional.empty());

        BusinessException exception = assertThrows(BusinessException.class, () -> 
            ticketService.getTicketById(999L));
        
        assertTrue(exception.getMessage().contains("Ticket not found"));
    }
}
