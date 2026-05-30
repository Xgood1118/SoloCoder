package com.bpm.engine.bpmn.model;

import com.bpm.engine.common.enums.ExpressionType;
import lombok.Data;

@Data
public class SequenceFlow {

    private String flowId;
    private String name;
    private String sourceRef;
    private String targetRef;
    private String conditionExpression;
    private ExpressionType conditionType;
    private boolean isDefault;
}
