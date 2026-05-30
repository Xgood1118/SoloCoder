package com.bpm.engine.history.entity;

import com.bpm.engine.common.enums.NodeType;
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
@Table(name = "bpm_historic_activity_instance", indexes = {
        @Index(name = "idx_hai_process_instance_id", columnList = "process_instance_id"),
        @Index(name = "idx_hai_activity_id", columnList = "activity_id"),
        @Index(name = "idx_hai_assignee", columnList = "assignee")
})
public class HistoricActivityInstanceEntity extends BaseEntity {

    @Column(name = "activity_instance_id", length = 64, nullable = false)
    private String activityInstanceId;

    @Column(name = "process_instance_id", length = 64, nullable = false)
    private String processInstanceId;

    @Column(name = "process_definition_id", length = 64)
    private String processDefinitionId;

    @Column(name = "execution_id", length = 64)
    private String executionId;

    @Column(name = "activity_id", length = 64)
    private String activityId;

    @Column(name = "activity_name", length = 255)
    private String activityName;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", length = 32)
    private NodeType activityType;

    @Column(name = "assignee", length = 64)
    private String assignee;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "duration_in_millis")
    private Long durationInMillis;

    @Column(name = "task_instance_id", length = 64)
    private String taskInstanceId;

    @Column(name = "is_canceled", nullable = false)
    private boolean isCanceled;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;
}
