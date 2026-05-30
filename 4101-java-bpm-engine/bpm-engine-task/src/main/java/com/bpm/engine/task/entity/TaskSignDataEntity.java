package com.bpm.engine.task.entity;

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
@Table(name = "bpm_task_sign_data")
public class TaskSignDataEntity extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private String taskId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "sign_type", nullable = false)
    private String signType;

    @Column(name = "operation_user_id")
    private String operationUserId;

    @Column(name = "operate_time")
    private LocalDateTime operateTime;

    @Column(name = "tenant_id")
    private String tenantId;
}
