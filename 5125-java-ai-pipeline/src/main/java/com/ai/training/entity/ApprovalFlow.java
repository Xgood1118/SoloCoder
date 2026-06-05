package com.ai.training.entity;

import com.ai.training.enums.ApprovalStatus;
import com.ai.training.enums.ModelType;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "approval_flow")
public class ApprovalFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    @Column(nullable = false)
    private Long modelVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ModelType modelType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ApprovalStatus status;

    @Column(length = 100)
    private String approver;

    @Column(columnDefinition = "TEXT")
    private String approvalComment;

    private LocalDateTime approvedAt;

    @Column(length = 100)
    private String applicant;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = ApprovalStatus.PENDING;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
