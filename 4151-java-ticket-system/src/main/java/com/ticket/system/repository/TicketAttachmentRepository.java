package com.ticket.system.repository;

import com.ticket.system.entity.TicketAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketAttachmentRepository extends JpaRepository<TicketAttachment, Long> {

    List<TicketAttachment> findByTicketId(Long ticketId);

    List<TicketAttachment> findByTicketIdAndCommentIdIsNull(Long ticketId);

    List<TicketAttachment> findByCommentId(Long commentId);

    void deleteByTicketId(Long ticketId);
}
