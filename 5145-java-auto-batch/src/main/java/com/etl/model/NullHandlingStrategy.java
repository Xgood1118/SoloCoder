package com.etl.model;

import java.util.List;

public class NullHandlingStrategy {

    public static enum NullStrategy {
        DEFAULT_VALUE, FORWARD_FILL, GROUP_FILL, EMPTY_STRING
    }

    private String targetField;
    private NullStrategy strategy;
    private String defaultValue;
    private List<String> groupKeyFields;
    private boolean treatBlankAsNull = true;

    public NullHandlingStrategy() {
    }

    public NullHandlingStrategy(String targetField, NullStrategy strategy, String defaultValue,
                                List<String> groupKeyFields, boolean treatBlankAsNull) {
        this.targetField = targetField;
        this.strategy = strategy;
        this.defaultValue = defaultValue;
        this.groupKeyFields = groupKeyFields;
        this.treatBlankAsNull = treatBlankAsNull;
    }

    public String getTargetField() {
        return targetField;
    }

    public void setTargetField(String targetField) {
        this.targetField = targetField;
    }

    public NullStrategy getStrategy() {
        return strategy;
    }

    public void setStrategy(NullStrategy strategy) {
        this.strategy = strategy;
    }

    public String getDefaultValue() {
        return defaultValue;
    }

    public void setDefaultValue(String defaultValue) {
        this.defaultValue = defaultValue;
    }

    public List<String> getGroupKeyFields() {
        return groupKeyFields;
    }

    public void setGroupKeyFields(List<String> groupKeyFields) {
        this.groupKeyFields = groupKeyFields;
    }

    public boolean isTreatBlankAsNull() {
        return treatBlankAsNull;
    }

    public void setTreatBlankAsNull(boolean treatBlankAsNull) {
        this.treatBlankAsNull = treatBlankAsNull;
    }
}
