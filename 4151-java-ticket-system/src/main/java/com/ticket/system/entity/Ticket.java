package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ticket")
@EqualsAndHashCode(callSuper = true)
public class Ticket extends BaseEntity {

    @Column(name = "ticket_no", unique = true, nullable = false, length = 50)
    private String ticketNo;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private TicketStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 20)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 30)
    private Source source;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "requester_id", nullable = false)
    private Long requesterId;

    @Column(name = "assignee_id")
    private Long assigneeId;

    @Column(name = "department_id")
    private Long departmentId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "response_due_at")
    private LocalDateTime responseDueAt;

    @Column(name = "resolved_due_at")
    private LocalDateTime resolvedDueAt;

    @Column(name = "first_response_at")
    private LocalDateTime firstResponseAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "reminder_count", nullable = false)
    private Integer reminderCount = 0;

    @Column(name = "escalation_level", nullable = false)
    private Integer escalationLevel = 0;

    @Column(name = "satisfaction_score")
    private Integer satisfactionScore;

    @Column(name = "satisfaction_comment", length = 500)
    private String satisfactionComment;

    @Column(name = "solution", columnDefinition = "TEXT")
    private String solution;

    @Column(name = "needs_review")
    private Boolean needsReview = false;

    @Column(name = "parent_ticket_id")
    private Long parentTicketId;

    public enum TicketStatus {
        NEW,
        PENDING_CONFIRM,
        IN_PROGRESS,
        PROCESSING,
        PENDING_ACCEPTANCE,
        CLOSED,
        CANCELLED
    }

    public enum Priority {
        URGENT,
        IMPORTANT,
        NORMAL,
        LOW
    }

    public enum Source {
        WEB_PORTAL,
        ADMIN_MANUAL,
        SYSTEM_AUTO,
        API,
        EMAIL,
        PHONE
    }
}
