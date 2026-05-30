package com.bpm.engine.runtime.entity;

import com.bpm.engine.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "bpm_timer_job")
public class TimerJobEntity extends BaseEntity {

    @Column(name = "process_instance_id", nullable = false)
    private String processInstanceId;

    @Column(name = "execution_id")
    private String executionId;

    @Column(name = "activity_id")
    private String activityId;

    @Column(name = "job_type", nullable = false)
    private String jobType;

    @Column(name = "job_handler_type", nullable = false)
    private String jobHandlerType;

    @Column(name = "job_handler_configuration", columnDefinition = "TEXT")
    private String jobHandlerConfiguration;

    @Column(name = "duedate")
    private LocalDateTime duedate;

    @Column(name = "repeat")
    private LocalDateTime repeat;

    @Column(name = "retries")
    private int retries = 3;

    @Column(name = "exception_message", columnDefinition = "TEXT")
    private String exceptionMessage;

    @Column(name = "is_suspended")
    private boolean isSuspended;

    @Column(name = "tenant_id")
    private String tenantId;

    @Column(name = "lock_owner")
    private String lockOwner;

    @Column(name = "lock_time")
    private LocalDateTime lockTime;
}
