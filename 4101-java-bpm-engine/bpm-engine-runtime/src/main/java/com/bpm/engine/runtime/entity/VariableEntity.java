package com.bpm.engine.runtime.entity;

import com.bpm.engine.common.enums.VariableType;
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
@Table(name = "bpm_variable", indexes = {
        @Index(name = "idx_variable_process_instance", columnList = "process_instance_id"),
        @Index(name = "idx_variable_name_text_length", columnList = "variable_name, text_length")
})
public class VariableEntity extends BaseEntity {

    @Column(name = "process_instance_id", nullable = false)
    private String processInstanceId;

    @Column(name = "execution_id")
    private String executionId;

    @Column(name = "task_id")
    private String taskId;

    @Column(name = "variable_name", nullable = false)
    private String variableName;

    @Enumerated(EnumType.STRING)
    @Column(name = "variable_type", nullable = false)
    private VariableType variableType;

    @Column(name = "text_value", columnDefinition = "TEXT")
    private String textValue;

    @Column(name = "long_value")
    private Long longValue;

    @Column(name = "double_value")
    private Double doubleValue;

    @Column(name = "json_value", columnDefinition = "TEXT")
    private String jsonValue;

    @Column(name = "date_value")
    private LocalDateTime dateValue;

    @Column(name = "text_length")
    private int textLength;

    @Column(name = "scope")
    private String scope;

    @Column(name = "tenant_id")
    private String tenantId;
}
