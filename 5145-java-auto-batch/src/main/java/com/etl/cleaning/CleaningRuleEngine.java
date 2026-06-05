package com.etl.cleaning;

import com.etl.model.CleaningRule;
import com.etl.model.CleaningRule.CleaningOperationType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CleaningRuleEngine {

    private static final Logger logger = LoggerFactory.getLogger(CleaningRuleEngine.class);

    private final List<CleaningRule> rules;
    private final ScriptExecutor scriptExecutor;

    public CleaningRuleEngine(List<CleaningRule> rules) {
        this.rules = new ArrayList<>(rules);
        this.scriptExecutor = new ScriptExecutor();
    }

    public void initialize() {
        rules.sort(Comparator.comparingInt(CleaningRule::getOrder));
        logger.info("Initialized cleaning rule engine with {} rules", rules.size());
    }

    public CleaningResult applyAll(Map<String, Object> record) {
        Map<String, Object> cleanedRecord = new HashMap<>(record);
        CleaningResult result = new CleaningResult();
        result.setCleanedRecord(cleanedRecord);

        for (CleaningRule rule : rules) {
            try {
                if (rule.getConditionExpression() != null && !rule.getConditionExpression().trim().isEmpty()) {
                    if (!ConditionEvaluator.evaluate(rule.getConditionExpression(), cleanedRecord)) {
                        continue;
                    }
                }

                String fieldName = resolveTargetField(rule);
                if (fieldName == null && rule.getOperationType() != CleaningOperationType.CUSTOM_SCRIPT) {
                    logger.warn("Cleaning rule '{}' has no targetField and no operationParams.fieldName, skipping", rule.getName());
                    continue;
                }

                Object value = fieldName != null ? cleanedRecord.get(fieldName) : null;
                Object newValue = applyRule(rule, fieldName, value, cleanedRecord);

                if (newValue != null && fieldName != null) {
                    cleanedRecord.put(fieldName, newValue);
                }

                result.addAppliedRule(rule.getName());
            } catch (Exception e) {
                logger.error("Error applying rule '{}': {}", rule.getName(), e.getMessage(), e);
                result.addError("Rule '" + rule.getName() + "' failed: " + e.getMessage());
            }
        }

        result.setCleanedRecord(cleanedRecord);
        return result;
    }

    private Object applyRule(CleaningRule rule, String fieldName, Object value, Map<String, Object> record) {
        Map<String, String> params = rule.getOperationParams();

        switch (rule.getOperationType()) {
            case TRIM:
                return value != null ? value.toString().trim() : null;

            case UPPER_CASE:
                return value != null ? value.toString().toUpperCase() : null;

            case LOWER_CASE:
                return value != null ? value.toString().toLowerCase() : null;

            case REGEX_REPLACE: {
                String pattern = params.get("pattern");
                String replacement = params.get("replacement");
                return value != null ? value.toString().replaceAll(pattern, replacement) : null;
            }

            case TRUNCATE: {
                int maxLength = Integer.parseInt(params.get("maxLength"));
                String marker = params.getOrDefault("marker", "…");
                if (value == null) return null;
                String str = value.toString();
                if (str.length() > maxLength) {
                    return str.substring(0, maxLength) + marker;
                }
                return str;
            }

            case RANGE_CHECK: {
                double min = Double.parseDouble(params.get("min"));
                double max = Double.parseDouble(params.get("max"));
                if (value != null) {
                    try {
                        double numValue = Double.parseDouble(value.toString());
                        if (numValue < min || numValue > max) {
                            record.put(fieldName + "_range_error", true);
                        }
                    } catch (NumberFormatException e) {
                        record.put(fieldName + "_range_error", true);
                    }
                }
                return value;
            }

            case CUSTOM_SCRIPT: {
                Map<String, Object> bindings = new HashMap<>();
                bindings.put("record", record);
                bindings.put("value", value);
                return scriptExecutor.execute(rule.getCustomScript(), bindings);
            }

            default:
                logger.warn("Unknown operation type: {}", rule.getOperationType());
                return value;
        }
    }

    private String resolveTargetField(CleaningRule rule) {
        if (rule.getTargetField() != null && !rule.getTargetField().trim().isEmpty()) {
            return rule.getTargetField();
        }
        if (rule.getOperationParams() != null) {
            String fieldName = rule.getOperationParams().get("fieldName");
            if (fieldName != null && !fieldName.trim().isEmpty()) {
                return fieldName;
            }
        }
        return null;
    }
}
