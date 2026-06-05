package com.etl.model;

import java.util.Map;

public class CleaningRule {

    public static enum CleaningOperationType {
        TRIM, UPPER_CASE, LOWER_CASE, REGEX_REPLACE, TRUNCATE, RANGE_CHECK, CUSTOM_SCRIPT
    }

    private String id;
    private String name;
    private int order;
    private String targetField;
    private String conditionExpression;
    private CleaningOperationType operationType;
    private Map<String, String> operationParams;
    private String customScript;

    public CleaningRule() {
    }

    public CleaningRule(String id, String name, int order, String targetField, String conditionExpression,
                        CleaningOperationType operationType, Map<String, String> operationParams,
                        String customScript) {
        this.id = id;
        this.name = name;
        this.order = order;
        this.targetField = targetField;
        this.conditionExpression = conditionExpression;
        this.operationType = operationType;
        this.operationParams = operationParams;
        this.customScript = customScript;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getOrder() {
        return order;
    }

    public void setOrder(int order) {
        this.order = order;
    }

    public String getTargetField() {
        return targetField;
    }

    public void setTargetField(String targetField) {
        this.targetField = targetField;
    }

    public String getConditionExpression() {
        return conditionExpression;
    }

    public void setConditionExpression(String conditionExpression) {
        this.conditionExpression = conditionExpression;
    }

    public CleaningOperationType getOperationType() {
        return operationType;
    }

    public void setOperationType(CleaningOperationType operationType) {
        this.operationType = operationType;
    }

    public Map<String, String> getOperationParams() {
        return operationParams;
    }

    public void setOperationParams(Map<String, String> operationParams) {
        this.operationParams = operationParams;
    }

    public String getCustomScript() {
        return customScript;
    }

    public void setCustomScript(String customScript) {
        this.customScript = customScript;
    }
}
