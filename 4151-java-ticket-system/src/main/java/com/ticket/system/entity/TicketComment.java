package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@Entity
@Table(name = "ticket_comment")
@EqualsAndHashCode(callSuper = true)
public class TicketComment extends BaseEntity {

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private CommentType type;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20)
    private Visibility visibility;

    @Column(name = "is_first_response")
    private Boolean isFirstResponse = false;

    @Column(name = "has_attachment")
    private Boolean hasAttachment = false;

    public enum CommentType {
        REPLY,
        INTERNAL_NOTE,
        STATUS_CHANGE,
        ASSIGNMENT_CHANGE,
        ESCALATION,
        SYSTEM_NOTE
    }

    public enum Visibility {
        PUBLIC,
        INTERNAL,
        PRIVATE
    }
}
