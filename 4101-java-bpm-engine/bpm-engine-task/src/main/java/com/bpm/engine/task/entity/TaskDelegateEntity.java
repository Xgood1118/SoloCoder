package com.bpm.engine.task.entity;

import com.bpm.engine.common.enums.DelegationType;
import com.bpm.engine.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "bpm_task_delegate")
public class TaskDelegateEntity extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private String taskId;

    @Column(name = "original_assignee", nullable = false)
    private String originalAssignee;

    @Column(name = "delegate_user_id", nullable = false)
    private String delegateUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "delegation_type", nullable = false)
    private DelegationType delegationType;

    @Column(name = "delegate_time")
    private LocalDateTime delegateTime;

    @Column(name = "resolve_time")
    private LocalDateTime resolveTime;

    @Column(name = "is_resolved")
    private boolean isResolved;

    @Column(name = "tenant_id")
    private String tenantId;
}
