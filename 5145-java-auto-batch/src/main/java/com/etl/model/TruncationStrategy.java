package com.etl.model;

public class TruncationStrategy {

    public static enum TruncationType {
        FRONT, BACK, REJECT_ROW
    }

    private String targetField;
    private int maxLength;
    private TruncationType truncationType;
    private String truncationMarker = "…";

    public TruncationStrategy() {
    }

    public TruncationStrategy(String targetField, int maxLength, TruncationType truncationType,
                              String truncationMarker) {
        this.targetField = targetField;
        this.maxLength = maxLength;
        this.truncationType = truncationType;
        this.truncationMarker = truncationMarker;
    }

    public String getTargetField() {
        return targetField;
    }

    public void setTargetField(String targetField) {
        this.targetField = targetField;
    }

    public int getMaxLength() {
        return maxLength;
    }

    public void setMaxLength(int maxLength) {
        this.maxLength = maxLength;
    }

    public TruncationType getTruncationType() {
        return truncationType;
    }

    public void setTruncationType(TruncationType truncationType) {
        this.truncationType = truncationType;
    }

    public String getTruncationMarker() {
        return truncationMarker;
    }

    public void setTruncationMarker(String truncationMarker) {
        this.truncationMarker = truncationMarker;
    }
}
