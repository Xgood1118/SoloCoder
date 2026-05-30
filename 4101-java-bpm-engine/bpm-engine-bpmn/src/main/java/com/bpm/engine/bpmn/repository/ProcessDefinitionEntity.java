package com.bpm.engine.bpmn.repository;

import com.bpm.engine.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "bpm_process_definition")
public class ProcessDefinitionEntity extends BaseEntity {

    @Column(name = "process_key", nullable = false)
    private String processKey;

    @Column(name = "name")
    private String name;

    @Column(name = "version")
    private int version;

    @Column(name = "category")
    private String category;

    @Lob
    @Column(name = "xml_content", columnDefinition = "TEXT")
    private String xmlContent;

    @Column(name = "is_executable")
    private Boolean isExecutable;

    @Column(name = "is_suspended")
    private Boolean isSuspended = false;

    @Column(name = "deployment_id")
    private String deploymentId;

    @Column(name = "tenant_id")
    private String tenantId;
}
