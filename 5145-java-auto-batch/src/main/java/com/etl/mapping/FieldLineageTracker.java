package com.etl.mapping;

import com.etl.model.FieldLineage;
import com.etl.model.FieldMappingRule;
import com.etl.model.FieldMappingRule.MappingType;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FieldLineageTracker {

    private static final Logger logger = LoggerFactory.getLogger(FieldLineageTracker.class);

    private static final Pattern FIELD_REF_PATTERN = Pattern.compile("\\$\\{(\\w+)}");

    private final List<FieldMappingRule> rules;
    private final Map<String, FieldMappingRule> ruleByTarget;

    public FieldLineageTracker(List<FieldMappingRule> rules) {
        this.rules = rules;
        this.ruleByTarget = new HashMap<>();
        for (FieldMappingRule rule : rules) {
            ruleByTarget.put(rule.getTargetField(), rule);
        }
    }

    public FieldLineage getLineage(String targetField) {
        FieldLineage lineage = new FieldLineage();
        lineage.setTargetField(targetField);
        Set<String> visited = new HashSet<>();
        buildLineage(targetField, lineage, visited);
        return lineage;
    }

    private void buildLineage(String targetField, FieldLineage lineage, Set<String> visited) {
        if (visited.contains(targetField)) {
            return;
        }
        visited.add(targetField);

        FieldMappingRule rule = ruleByTarget.get(targetField);
        if (rule == null) {
            lineage.addSourceField(targetField);
            return;
        }

        switch (rule.getMappingType()) {
            case DIRECT:
                lineage.addSourceField(rule.getSourceField());
                lineage.addCalculationRule("DIRECT: " + rule.getSourceField() + " -> " + targetField);
                if (ruleByTarget.containsKey(rule.getSourceField())) {
                    buildLineage(rule.getSourceField(), lineage, visited);
                }
                break;
            case COMPUTED:
                Matcher matcher = FIELD_REF_PATTERN.matcher(rule.getExpression());
                while (matcher.find()) {
                    String fieldName = matcher.group(1);
                    lineage.addSourceField(fieldName);
                    if (ruleByTarget.containsKey(fieldName)) {
                        buildLineage(fieldName, lineage, visited);
                    }
                }
                lineage.addCalculationRule("COMPUTED: " + rule.getExpression());
                break;
            case CONDITIONAL:
                if (rule.getConditionExpression() != null) {
                    String conditionField = rule.getConditionExpression().split("=", 2)[0];
                    lineage.addSourceField(conditionField);
                    if (ruleByTarget.containsKey(conditionField)) {
                        buildLineage(conditionField, lineage, visited);
                    }
                }
                lineage.addCalculationRule("CONDITIONAL: " + rule.getConditionExpression());
                break;
        }
    }

    public Map<String, FieldLineage> getAllLineages() {
        Map<String, FieldLineage> lineages = new HashMap<>();
        for (FieldMappingRule rule : rules) {
            lineages.put(rule.getTargetField(), getLineage(rule.getTargetField()));
        }
        return lineages;
    }
}
