package com.etl.truncate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TruncationResult {

    private Map<String, Object> record;
    private boolean rejected;
    private List<String> truncatedFields;
    private List<String> rejectedFields;

    public TruncationResult() {
        this.record = new HashMap<>();
        this.rejected = false;
        this.truncatedFields = new ArrayList<>();
        this.rejectedFields = new ArrayList<>();
    }

    public TruncationResult(Map<String, Object> record) {
        this.record = record;
        this.rejected = false;
        this.truncatedFields = new ArrayList<>();
        this.rejectedFields = new ArrayList<>();
    }

    public void addTruncatedField(String fieldName) {
        this.truncatedFields.add(fieldName);
    }

    public void addRejectedField(String fieldName) {
        this.rejectedFields.add(fieldName);
    }

    public Map<String, Object> getRecord() {
        return record;
    }

    public void setRecord(Map<String, Object> record) {
        this.record = record;
    }

    public boolean isRejected() {
        return rejected;
    }

    public void setRejected(boolean rejected) {
        this.rejected = rejected;
    }

    public List<String> getTruncatedFields() {
        return truncatedFields;
    }

    public void setTruncatedFields(List<String> truncatedFields) {
        this.truncatedFields = truncatedFields;
    }

    public List<String> getRejectedFields() {
        return rejectedFields;
    }

    public void setRejectedFields(List<String> rejectedFields) {
        this.rejectedFields = rejectedFields;
    }
}
