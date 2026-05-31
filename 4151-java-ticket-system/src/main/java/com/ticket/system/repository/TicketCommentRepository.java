package com.ticket.system.repository;

import com.ticket.system.entity.TicketComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketCommentRepository extends JpaRepository<TicketComment, Long>, JpaSpecificationExecutor<TicketComment> {

    List<TicketComment> findByTicketIdOrderByCreatedAtDesc(Long ticketId);

    @Query("SELECT c FROM TicketComment c WHERE c.ticketId = ?1 AND c.visibility = ?2 ORDER BY c.createdAt DESC")
    List<TicketComment> findByTicketIdAndVisibilityOrderByCreatedAtDesc(Long ticketId, TicketComment.Visibility visibility);

    List<TicketComment> findByTicketIdAndTypeOrderByCreatedAtDesc(Long ticketId, TicketComment.CommentType type);

    boolean existsByTicketIdAndIsFirstResponseTrue(Long ticketId);

    int countByTicketIdAndType(Long ticketId, TicketComment.CommentType type);
}
