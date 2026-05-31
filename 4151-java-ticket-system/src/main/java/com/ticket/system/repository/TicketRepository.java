package com.ticket.system.repository;

import com.ticket.system.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {

    Optional<Ticket> findByTicketNo(String ticketNo);

    List<Ticket> findByRequesterIdAndDeletedFalse(Long requesterId);

    List<Ticket> findByAssigneeIdAndDeletedFalse(Long assigneeId);

    List<Ticket> findByStatusInAndDeletedFalse(List<Ticket.TicketStatus> statuses);

    List<Ticket> findByCategoryIdAndDeletedFalse(Long categoryId);

    @Query("SELECT t FROM Ticket t WHERE t.status IN ?1 AND t.deleted = false AND t.createdAt BETWEEN ?2 AND ?3")
    List<Ticket> findByStatusInAndCreatedAtBetween(List<Ticket.TicketStatus> statuses, LocalDateTime start, LocalDateTime end);

    @Query("SELECT t FROM Ticket t WHERE t.assigneeId = ?1 AND t.status IN ?2 AND t.deleted = false")
    List<Ticket> findByAssigneeIdAndStatusIn(Long assigneeId, List<Ticket.TicketStatus> statuses);

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status = ?1 AND t.deleted = false")
    long countByStatus(Ticket.TicketStatus status);

    boolean existsByTicketNo(String ticketNo);

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.assigneeId = ?1 AND t.deleted = false AND t.status NOT IN (com.ticket.system.entity.Ticket$TicketStatus.CLOSED, com.ticket.system.entity.Ticket$TicketStatus.CANCELLED)")
    long countActiveTicketsByAssignee(Long assigneeId);
}
