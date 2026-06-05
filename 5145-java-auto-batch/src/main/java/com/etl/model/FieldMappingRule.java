package com.etl.model;

import java.util.List;
import java.util.Map;

public class FieldMappingRule {

    public static enum MappingType {
        DIRECT, COMPUTED, CONDITIONAL
    }

    private String id;
    private String sourceField;
    private String targetField;
    private MappingType mappingType;
    private String expression;
    private String conditionExpression;
    private Map<String, String> conditionTargets;
    private String targetType;
    private String sourceType;
    private List<String> dependencies;
    private FieldLineage lineage;

    public FieldMappingRule() {
    }

    public FieldMappingRule(String id, String sourceField, String targetField, MappingType mappingType,
                            String expression, String conditionExpression, Map<String, String> conditionTargets,
                            String targetType, String sourceType, List<String> dependencies, FieldLineage lineage) {
        this.id = id;
        this.sourceField = sourceField;
        this.targetField = targetField;
        this.mappingType = mappingType;
        this.expression = expression;
        this.conditionExpression = conditionExpression;
        this.conditionTargets = conditionTargets;
        this.targetType = targetType;
        this.sourceType = sourceType;
        this.dependencies = dependencies;
        this.lineage = lineage;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSourceField() {
        return sourceField;
    }

    public void setSourceField(String sourceField) {
        this.sourceField = sourceField;
    }

    public String getTargetField() {
        return targetField;
    }

    public void setTargetField(String targetField) {
        this.targetField = targetField;
    }

    public MappingType getMappingType() {
        return mappingType;
    }

    public void setMappingType(MappingType mappingType) {
        this.mappingType = mappingType;
    }

    public String getExpression() {
        return expression;
    }

    public void setExpression(String expression) {
        this.expression = expression;
    }

    public String getConditionExpression() {
        return conditionExpression;
    }

    public void setConditionExpression(String conditionExpression) {
        this.conditionExpression = conditionExpression;
    }

    public Map<String, String> getConditionTargets() {
        return conditionTargets;
    }

    public void setConditionTargets(Map<String, String> conditionTargets) {
        this.conditionTargets = conditionTargets;
    }

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public List<String> getDependencies() {
        return dependencies;
    }

    public void setDependencies(List<String> dependencies) {
        this.dependencies = dependencies;
    }

    public FieldLineage getLineage() {
        return lineage;
    }

    public void setLineage(FieldLineage lineage) {
        this.lineage = lineage;
    }
}
