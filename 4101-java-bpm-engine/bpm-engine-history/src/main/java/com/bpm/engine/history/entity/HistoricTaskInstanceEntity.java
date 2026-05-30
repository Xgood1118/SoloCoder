package com.bpm.engine.history.entity;

import com.bpm.engine.common.enums.TaskStatus;
import com.bpm.engine.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "bpm_historic_task_instance", indexes = {
        @Index(name = "idx_hti_process_instance_id", columnList = "process_instance_id"),
        @Index(name = "idx_hti_assignee_status", columnList = "assignee, status"),
        @Index(name = "idx_hti_create_time", columnList = "create_time")
})
public class HistoricTaskInstanceEntity extends BaseEntity {

    @Column(name = "task_instance_id", length = 64, nullable = false)
    private String taskInstanceId;

    @Column(name = "process_instance_id", length = 64, nullable = false)
    private String processInstanceId;

    @Column(name = "process_definition_id", length = 64)
    private String processDefinitionId;

    @Column(name = "execution_id", length = 64)
    private String executionId;

    @Column(name = "task_definition_key", length = 64)
    private String taskDefinitionKey;

    @Column(name = "task_name", length = 255)
    private String taskName;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "owner", length = 64)
    private String owner;

    @Column(name = "assignee", length = 64)
    private String assignee;

    @Column(name = "delegate_user_id", length = 64)
    private String delegateUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32)
    private TaskStatus status;

    @Column(name = "task_create_time")
    private LocalDateTime createTime;

    @Column(name = "claim_time")
    private LocalDateTime claimTime;

    @Column(name = "complete_time")
    private LocalDateTime completeTime;

    @Column(name = "duration_in_millis")
    private Long durationInMillis;

    @Column(name = "outcome", length = 64)
    private String outcome;

    @Column(name = "delete_reason", length = 500)
    private String deleteReason;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "form_key", length = 255)
    private String formKey;

    @Column(name = "business_key", length = 255)
    private String businessKey;
}
