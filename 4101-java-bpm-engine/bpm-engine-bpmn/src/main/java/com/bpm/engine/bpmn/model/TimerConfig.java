package com.bpm.engine.bpmn.model;

import com.bpm.engine.common.enums.ExpressionType;
import lombok.Data;

@Data
public class TimerConfig {

    private String timeDuration;
    private String timeDate;
    private String timeCycle;
    private ExpressionType expressionType;
}
