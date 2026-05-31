package com.ticket.system.service;

import com.ticket.system.entity.Ticket;
import com.ticket.system.entity.TicketComment;
import com.ticket.system.exception.BusinessException;
import com.ticket.system.repository.TicketCommentRepository;
import com.ticket.system.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketCommentService {

    private final TicketCommentRepository commentRepository;
    private final TicketRepository ticketRepository;
    private final SlaService slaService;
    private final NotificationService notificationService;

    @Transactional
    public TicketComment addComment(Long ticketId, Long authorId, String content,
                                    TicketComment.CommentType type,
                                    TicketComment.Visibility visibility) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new BusinessException("Ticket not found: " + ticketId));

        if (content == null || content.trim().isEmpty()) {
            throw new BusinessException("Comment content cannot be empty");
        }

        TicketComment comment = new TicketComment();
        comment.setTicketId(ticketId);
        comment.setAuthorId(authorId);
        comment.setContent(content);
        comment.setType(type);
        comment.setVisibility(visibility);

        boolean isFirstResponse = isFirstAgentResponse(ticketId, authorId);
        if (isFirstResponse) {
            comment.setIsFirstResponse(true);
            slaService.markResponseComplete(ticket);
            ticketRepository.save(ticket);
        }

        TicketComment savedComment = commentRepository.save(comment);
        notificationService.sendCommentNotification(ticket, authorId);

        log.info("Comment added to ticket {} by user {}", ticketId, authorId);
        return savedComment;
    }

    private boolean isFirstAgentResponse(Long ticketId, Long authorId) {
        boolean hasFirstResponse = commentRepository.existsByTicketIdAndIsFirstResponseTrue(ticketId);
        return !hasFirstResponse;
    }

    public TicketComment addReply(Long ticketId, Long authorId, String content) {
        return addComment(ticketId, authorId, content,
                TicketComment.CommentType.REPLY,
                TicketComment.Visibility.PUBLIC);
    }

    public TicketComment addInternalNote(Long ticketId, Long authorId, String content) {
        return addComment(ticketId, authorId, content,
                TicketComment.CommentType.INTERNAL_NOTE,
                TicketComment.Visibility.INTERNAL);
    }

    @Transactional
    public void addStatusChangeComment(Long ticketId, Long authorId,
                                       Ticket.TicketStatus oldStatus,
                                       Ticket.TicketStatus newStatus) {
        String content = String.format("Status changed from %s to %s", oldStatus, newStatus);
        addComment(ticketId, authorId, content,
                TicketComment.CommentType.STATUS_CHANGE,
                TicketComment.Visibility.INTERNAL);
    }

    @Transactional
    public void addAssignmentChangeComment(Long ticketId, Long authorId,
                                           Long oldAssigneeId, Long newAssigneeId) {
        String content = String.format("Assignee changed from %d to %d", oldAssigneeId, newAssigneeId);
        addComment(ticketId, authorId, content,
                TicketComment.CommentType.ASSIGNMENT_CHANGE,
                TicketComment.Visibility.INTERNAL);
    }

    public List<TicketComment> getTicketComments(Long ticketId) {
        return commentRepository.findByTicketIdOrderByCreatedAtDesc(ticketId);
    }

    public List<TicketComment> getPublicComments(Long ticketId) {
        return commentRepository.findByTicketIdAndVisibilityOrderByCreatedAtDesc(
                ticketId, TicketComment.Visibility.PUBLIC);
    }

    public List<TicketComment> getInternalComments(Long ticketId) {
        return commentRepository.findByTicketIdAndVisibilityOrderByCreatedAtDesc(
                ticketId, TicketComment.Visibility.INTERNAL);
    }

    @Transactional
    public void deleteComment(Long commentId, Long operatorId) {
        TicketComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new BusinessException("Comment not found: " + commentId));

        if (!comment.getAuthorId().equals(operatorId)) {
            throw new BusinessException("Only the author can delete the comment");
        }

        commentRepository.delete(comment);
        log.info("Comment {} deleted by user {}", commentId, operatorId);
    }
}
