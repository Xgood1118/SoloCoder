package com.ticket.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "ticket_transfer")
@EqualsAndHashCode(callSuper = true)
public class TicketTransfer extends BaseEntity {

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "from_user_id", nullable = false)
    private Long fromUserId;

    @Column(name = "to_user_id", nullable = false)
    private Long toUserId;

    @Column(name = "from_department_id")
    private Long fromDepartmentId;

    @Column(name = "to_department_id")
    private Long toDepartmentId;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TransferStatus status;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "confirm_remark", length = 500)
    private String confirmRemark;

    public enum TransferStatus {
        PENDING,
        ACCEPTED,
        REJECTED,
        CANCELLED
    }
}
