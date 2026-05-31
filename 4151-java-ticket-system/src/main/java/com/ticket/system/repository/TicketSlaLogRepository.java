package com.ticket.system.repository;

import com.ticket.system.entity.TicketSlaLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketSlaLogRepository extends JpaRepository<TicketSlaLog, Long> {

    List<TicketSlaLog> findByTicketId(Long ticketId);

    List<TicketSlaLog> findByTicketIdAndSlaType(Long ticketId, TicketSlaLog.SlaType slaType);

    List<TicketSlaLog> findByBreachedTrue();

    List<TicketSlaLog> findByTicketIdAndBreachedTrue(Long ticketId);
}
