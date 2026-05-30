package com.bpm.engine.history.entity;

import com.bpm.engine.common.enums.VariableType;
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
@Table(name = "bpm_historic_variable_instance", indexes = {
        @Index(name = "idx_hvi_process_instance_id", columnList = "process_instance_id"),
        @Index(name = "idx_hvi_variable_name", columnList = "variable_name")
})
public class HistoricVariableInstanceEntity extends BaseEntity {

    @Column(name = "variable_instance_id", length = 64, nullable = false)
    private String variableInstanceId;

    @Column(name = "process_instance_id", length = 64, nullable = false)
    private String processInstanceId;

    @Column(name = "execution_id", length = 64)
    private String executionId;

    @Column(name = "task_id", length = 64)
    private String taskId;

    @Column(name = "variable_name", length = 255, nullable = false)
    private String variableName;

    @Enumerated(EnumType.STRING)
    @Column(name = "variable_type", length = 32)
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

    @Column(name = "scope", length = 64)
    private String scope;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;
}
