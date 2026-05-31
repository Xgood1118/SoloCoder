package com.ticket.system.service;

import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.User;
import com.ticket.system.repository.TicketCategoryRepository;
import com.ticket.system.repository.TicketRepository;
import com.ticket.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketAssignmentService {

    private final UserRepository userRepository;
    private final TicketCategoryRepository categoryRepository;
    private final TicketRepository ticketRepository;

    private final AtomicInteger roundRobinCounter = new AtomicInteger(0);

    public void autoAssign(Ticket ticket) {
        if (ticket.getAssigneeId() != null) {
            return;
        }

        Long categoryId = ticket.getCategoryId();
        categoryRepository.findById(categoryId).ifPresent(category -> {
            if (category.getDefaultAssigneeId() != null) {
                ticket.setAssigneeId(category.getDefaultAssigneeId());
                ticket.setDepartmentId(category.getDefaultDepartmentId());
                log.info("Ticket {} assigned to default assignee {} from category", 
                        ticket.getTicketNo(), category.getDefaultAssigneeId());
                return;
            }
            
            if (category.getDefaultDepartmentId() != null) {
                assignToLeastBusyUser(ticket, category.getDefaultDepartmentId());
            }
        });

        if (ticket.getAssigneeId() == null) {
            assignUsingRoundRobin(ticket);
        }
    }

    private void assignToLeastBusyUser(Ticket ticket, Long departmentId) {
        List<User> agents = userRepository.findByDepartmentIdAndEnabledTrue(departmentId);
        if (agents.isEmpty()) {
            return;
        }

        User leastBusy = agents.stream()
                .min((u1, u2) -> {
                    long count1 = getActiveTicketCount(u1.getId());
                    long count2 = getActiveTicketCount(u2.getId());
                    return Long.compare(count1, count2);
                })
                .orElse(null);

        if (leastBusy != null) {
            ticket.setAssigneeId(leastBusy.getId());
            ticket.setDepartmentId(departmentId);
            log.info("Ticket {} assigned to least busy user {} in department {}", 
                    ticket.getTicketNo(), leastBusy.getId(), departmentId);
        }
    }

    private void assignUsingRoundRobin(Ticket ticket) {
        List<User> agents = userRepository.findByRolesIn(
                List.of(User.Role.AGENT, User.Role.IT_OPERATOR, User.Role.ADMIN)
        );
        
        if (agents.isEmpty()) {
            log.warn("No available agents to assign ticket {}, leaving unassigned", ticket.getTicketNo());
            return;
        }

        int index = Math.abs(roundRobinCounter.getAndIncrement()) % agents.size();
        User selectedAgent = agents.get(index);
        
        ticket.setAssigneeId(selectedAgent.getId());
        ticket.setDepartmentId(selectedAgent.getDepartmentId());
        
        log.info("Ticket {} assigned using round-robin to user {}", 
                ticket.getTicketNo(), selectedAgent.getId());
    }

    public long getActiveTicketCount(Long userId) {
        return ticketRepository.countActiveTicketsByAssignee(userId);
    }
}
