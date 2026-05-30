package com.bpm.engine.task.entity;

import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "bpm_task", indexes = {
        @Index(name = "idx_task_assignee_status", columnList = "assignee,status"),
        @Index(name = "idx_task_process_instance_id", columnList = "process_instance_id"),
        @Index(name = "idx_task_definition_key", columnList = "task_definition_key")
})
public class TaskEntity extends BaseEntity {

    @Column(name = "process_instance_id", nullable = false)
    private String processInstanceId;

    @Column(name = "process_definition_id", nullable = false)
    private String processDefinitionId;

    @Column(name = "execution_id", nullable = false)
    private String executionId;

    @Column(name = "task_definition_key", nullable = false)
    private String taskDefinitionKey;

    @Column(name = "task_name")
    private String taskName;

    @Column(name = "description")
    private String description;

    @Column(name = "owner")
    private String owner;

    @Column(name = "assignee")
    private String assignee;

    @Column(name = "delegate_user_id")
    private String delegateUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TaskStatus status;

    @Column(name = "form_key")
    private String formKey;

    @Column(name = "business_key")
    private String businessKey;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "claim_time")
    private LocalDateTime claimTime;

    @Column(name = "complete_time")
    private LocalDateTime completeTime;

    @Column(name = "outcome")
    private String outcome;

    @Column(name = "comment", length = 2000)
    private String comment;

    @Column(name = "priority")
    private Integer priority = 50;

    @Column(name = "tenant_id")
    private String tenantId;
}
