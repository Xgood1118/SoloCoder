package com.etl.cleaning;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CleaningResult {

    private Map<String, Object> cleanedRecord;
    private List<String> appliedRules;
    private boolean hasErrors;
    private List<String> errorMessages;

    public CleaningResult() {
        this.cleanedRecord = new HashMap<>();
        this.appliedRules = new ArrayList<>();
        this.hasErrors = false;
        this.errorMessages = new ArrayList<>();
    }

    public CleaningResult(Map<String, Object> cleanedRecord, List<String> appliedRules, boolean hasErrors, List<String> errorMessages) {
        this.cleanedRecord = cleanedRecord;
        this.appliedRules = appliedRules;
        this.hasErrors = hasErrors;
        this.errorMessages = errorMessages;
    }

    public void addAppliedRule(String ruleName) {
        this.appliedRules.add(ruleName);
    }

    public void addError(String errorMsg) {
        this.hasErrors = true;
        this.errorMessages.add(errorMsg);
    }

    public Map<String, Object> getCleanedRecord() {
        return cleanedRecord;
    }

    public void setCleanedRecord(Map<String, Object> cleanedRecord) {
        this.cleanedRecord = cleanedRecord;
    }

    public List<String> getAppliedRules() {
        return appliedRules;
    }

    public void setAppliedRules(List<String> appliedRules) {
        this.appliedRules = appliedRules;
    }

    public boolean isHasErrors() {
        return hasErrors;
    }

    public void setHasErrors(boolean hasErrors) {
        this.hasErrors = hasErrors;
    }

    public List<String> getErrorMessages() {
        return errorMessages;
    }

    public void setErrorMessages(List<String> errorMessages) {
        this.errorMessages = errorMessages;
    }
}
