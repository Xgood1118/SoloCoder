package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ticket_sla_log")
@EqualsAndHashCode(callSuper = true)
public class TicketSlaLog extends BaseEntity {

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sla_type", nullable = false, length = 20)
    private SlaType slaType;

    @Column(name = "due_at", nullable = false)
    private LocalDateTime dueAt;

    @Column(name = "actual_at")
    private LocalDateTime actualAt;

    @Column(name = "breached", nullable = false)
    private Boolean breached = false;

    @Column(name = "warning_sent")
    private Boolean warningSent = false;

    @Column(name = "warning_sent_at")
    private LocalDateTime warningSentAt;

    @Column(name = "escalation_level")
    private Integer escalationLevel = 0;

    @Column(name = "breach_duration_minutes")
    private Long breachDurationMinutes;

    public enum SlaType {
        RESPONSE_TIME,
        RESOLUTION_TIME
    }
}
