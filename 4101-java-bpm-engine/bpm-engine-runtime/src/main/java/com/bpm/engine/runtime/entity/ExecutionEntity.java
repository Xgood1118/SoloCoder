package com.bpm.engine.runtime.entity;

import com.bpm.engine.common.enums.NodeType;
import com.bpm.engine.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "bpm_execution")
public class ExecutionEntity extends BaseEntity {

    @Column(name = "process_instance_id", nullable = false)
    private String processInstanceId;

    @Column(name = "process_definition_id", nullable = false)
    private String processDefinitionId;

    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "activity_id")
    private String activityId;

    @Column(name = "activity_name")
    private String activityName;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type")
    private NodeType activityType;

    @Column(name = "is_active")
    private boolean isActive;

    @Column(name = "is_concurrent")
    private boolean isConcurrent;

    @Column(name = "is_scope")
    private boolean isScope;

    @Column(name = "tenant_id")
    private String tenantId;
}
