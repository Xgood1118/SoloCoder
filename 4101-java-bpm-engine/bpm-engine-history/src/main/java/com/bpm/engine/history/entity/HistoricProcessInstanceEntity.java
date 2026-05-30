package com.bpm.engine.history.entity;

import com.bpm.engine.common.enums.ArchiveStatus;
import com.bpm.engine.common.enums.ProcessStatus;
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
@Table(name = "bpm_historic_process_instance", indexes = {
        @Index(name = "idx_process_key_start_time", columnList = "process_key, start_time"),
        @Index(name = "idx_status", columnList = "status")
})
public class HistoricProcessInstanceEntity extends BaseEntity {

    @Column(name = "process_instance_id", length = 64, nullable = false)
    private String processInstanceId;

    @Column(name = "process_definition_id", length = 64)
    private String processDefinitionId;

    @Column(name = "process_key", length = 64)
    private String processKey;

    @Column(name = "process_name", length = 255)
    private String processName;

    @Column(name = "version")
    private Integer version;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32)
    private ProcessStatus status;

    @Column(name = "start_user_id", length = 64)
    private String startUserId;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "end_activity_id", length = 64)
    private String endActivityId;

    @Column(name = "start_activity_id", length = 64)
    private String startActivityId;

    @Column(name = "duration_in_millis")
    private Long durationInMillis;

    @Column(name = "delete_reason", length = 500)
    private String deleteReason;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "business_key", length = 255)
    private String businessKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "archive_status", length = 32)
    private ArchiveStatus archiveStatus = ArchiveStatus.ACTIVE;
}
