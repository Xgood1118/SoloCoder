package com.bpm.engine.bpmn.model;

import com.bpm.engine.common.enums.MultiInstanceCompletion;
import com.bpm.engine.common.enums.MultiInstanceType;
import lombok.Data;

@Data
public class MultiInstanceConfig {

    private MultiInstanceType type;
    private MultiInstanceCompletion completionCondition;
    private String collectionExpression;
    private String variableName;
    private int loopCount;
    private double completionRatio;
}
