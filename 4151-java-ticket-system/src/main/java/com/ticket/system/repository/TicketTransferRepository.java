package com.ticket.system.repository;

import com.ticket.system.entity.TicketTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketTransferRepository extends JpaRepository<TicketTransfer, Long> {

    List<TicketTransfer> findByTicketIdOrderByCreatedAtDesc(Long ticketId);

    List<TicketTransfer> findByToUserIdAndStatus(Long toUserId, TicketTransfer.TransferStatus status);

    List<TicketTransfer> findByFromUserIdOrderByCreatedAtDesc(Long fromUserId);

    List<TicketTransfer> findByTicketIdAndStatus(Long ticketId, TicketTransfer.TransferStatus status);
}
