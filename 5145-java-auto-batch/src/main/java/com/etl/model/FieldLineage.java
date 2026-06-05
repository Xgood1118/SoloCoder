package com.etl.model;

import java.util.ArrayList;
import java.util.List;

public class FieldLineage {

    private String targetField;
    private List<String> sourceFields;
    private List<String> calculationRules;

    public FieldLineage() {
        this.sourceFields = new ArrayList<>();
        this.calculationRules = new ArrayList<>();
    }

    public FieldLineage(String targetField, List<String> sourceFields, List<String> calculationRules) {
        this.targetField = targetField;
        this.sourceFields = sourceFields;
        this.calculationRules = calculationRules;
    }

    public void addSourceField(String sourceField) {
        this.sourceFields.add(sourceField);
    }

    public void addCalculationRule(String calculationRule) {
        this.calculationRules.add(calculationRule);
    }

    public String getTargetField() {
        return targetField;
    }

    public void setTargetField(String targetField) {
        this.targetField = targetField;
    }

    public List<String> getSourceFields() {
        return sourceFields;
    }

    public void setSourceFields(List<String> sourceFields) {
        this.sourceFields = sourceFields;
    }

    public List<String> getCalculationRules() {
        return calculationRules;
    }

    public void setCalculationRules(List<String> calculationRules) {
        this.calculationRules = calculationRules;
    }
}
