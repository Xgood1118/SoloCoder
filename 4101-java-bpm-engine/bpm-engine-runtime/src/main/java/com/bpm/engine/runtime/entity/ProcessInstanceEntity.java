package com.bpm.engine.runtime.entity;

import com.bpm.engine.common.enums.ProcessStatus;
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
@Table(name = "bpm_process_instance")
public class ProcessInstanceEntity extends BaseEntity {

    @Column(name = "process_definition_id", nullable = false)
    private String processDefinitionId;

    @Column(name = "process_key", nullable = false)
    private String processKey;

    @Column(name = "process_name")
    private String processName;

    @Column(name = "version")
    private Integer version;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProcessStatus status;

    @Column(name = "business_key")
    private String businessKey;

    @Column(name = "start_user_id")
    private String startUserId;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "start_activity_id")
    private String startActivityId;

    @Column(name = "end_activity_id")
    private String endActivityId;

    @Column(name = "duration_in_millis")
    private Long durationInMillis;

    @Column(name = "is_suspended")
    private boolean isSuspended;

    @Column(name = "delete_reason")
    private String deleteReason;

    @Column(name = "tenant_id")
    private String tenantId;
}
