package com.audit.common.model;

import com.audit.common.enums.AlarmLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlarmRule {

    private String id;
    private String name;
    private String description;
    private boolean enabled;

    private String conditionType;
    private String conditionExpression;
    private int threshold;
    private int windowSeconds;

    private AlarmLevel alarmLevel;
    private List<String> autoActions;
    private List<String> notifyTargets;

    private int suppressWindowSeconds;
    private int maxSuppressCount;

    private Map<String, String> metadata;
}
