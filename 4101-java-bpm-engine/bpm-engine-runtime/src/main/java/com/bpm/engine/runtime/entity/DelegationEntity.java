package com.bpm.engine.runtime.entity;

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
@Table(name = "bpm_delegation")
public class DelegationEntity extends BaseEntity {

    @Column(name = "delegator_id", nullable = false)
    private String delegatorId;

    @Column(name = "delegate_user_id", nullable = false)
    private String delegateUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "delegation_type", nullable = false)
    private DelegationType delegationType;

    @Column(name = "process_definition_id")
    private String processDefinitionId;

    @Column(name = "effective_time")
    private LocalDateTime effectiveTime;

    @Column(name = "expiry_time")
    private LocalDateTime expiryTime;

    @Column(name = "is_enabled")
    private boolean isEnabled;

    @Column(name = "tenant_id")
    private String tenantId;
}
