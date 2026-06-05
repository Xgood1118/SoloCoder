package com.etl.mapping;

import com.etl.model.FieldMappingRule;
import com.etl.model.FieldMappingRule.MappingType;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FieldMappingEngine {

    private static final Logger logger = LoggerFactory.getLogger(FieldMappingEngine.class);

    private static final Pattern FIELD_REF_PATTERN = Pattern.compile("\\$\\{(\\w+)}");

    private final List<FieldMappingRule> rules;
    private List<FieldMappingRule> sortedRules;

    public FieldMappingEngine(List<FieldMappingRule> rules) {
        this.rules = rules;
    }

    public void initialize() {
        this.sortedRules = TopologicalSorter.sort(rules);
        logger.info("Field mapping engine initialized with {} rules in topological order", sortedRules.size());
    }

    public Map<String, Object> apply(Map<String, Object> sourceRecord) {
        Map<String, Object> targetRecord = new HashMap<>(sourceRecord);
        for (FieldMappingRule rule : sortedRules) {
            try {
                Object value = null;
                switch (rule.getMappingType()) {
                    case DIRECT:
                        value = applyDirectMapping(rule, sourceRecord);
                        break;
                    case COMPUTED:
                        value = applyComputedMapping(rule, targetRecord);
                        break;
                    case CONDITIONAL:
                        value = applyConditionalMapping(rule, sourceRecord);
                        break;
                }
                if (rule.getTargetType() != null && value != null) {
                    value = convertType(value, rule.getTargetType());
                }
                targetRecord.put(rule.getTargetField(), value);
            } catch (Exception e) {
                logger.error("Error applying mapping rule for target field {}: {}", rule.getTargetField(), e.getMessage());
                targetRecord.put(rule.getTargetField(), null);
            }
        }
        return targetRecord;
    }

    private Object applyDirectMapping(FieldMappingRule rule, Map<String, Object> source) {
        return source.get(rule.getSourceField());
    }

    private Object applyComputedMapping(FieldMappingRule rule, Map<String, Object> context) {
        String expression = rule.getExpression();

        if (expression.startsWith("DATE_FORMAT:")) {
            String[] parts = expression.split(":", 3);
            if (parts.length >= 3) {
                String dateField = parts[1];
                String pattern = parts[2];
                Object dateValue = context.get(dateField);
                if (dateValue instanceof Date) {
                    return new SimpleDateFormat(pattern).format((Date) dateValue);
                } else if (dateValue instanceof String) {
                    try {
                        Date date = parseDate((String) dateValue);
                        if (date != null) {
                            return new SimpleDateFormat(pattern).format(date);
                        }
                    } catch (ParseException e) {
                        logger.error("Failed to parse date value: {}", dateValue);
                    }
                }
            }
            return null;
        }

        boolean hasArithmetic = expression.matches(".*[+\\-*/].*");
        if (hasArithmetic) {
            String evalExpression = expression;
            Matcher matcher = FIELD_REF_PATTERN.matcher(expression);
            while (matcher.find()) {
                String fieldName = matcher.group(1);
                Object fieldValue = context.get(fieldName);
                String strValue = fieldValue != null ? fieldValue.toString() : "0";
                evalExpression = evalExpression.replace("${" + fieldName + "}", strValue);
            }
            try {
                ScriptEngineManager manager = new ScriptEngineManager();
                ScriptEngine engine = manager.getEngineByName("js");
                return engine.eval(evalExpression);
            } catch (Exception e) {
                logger.error("Failed to evaluate arithmetic expression: {}", evalExpression);
                return null;
            }
        }

        Matcher matcher = FIELD_REF_PATTERN.matcher(expression);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String fieldName = matcher.group(1);
            Object fieldValue = context.get(fieldName);
            String strValue = fieldValue != null ? fieldValue.toString() : "";
            matcher.appendReplacement(sb, Matcher.quoteReplacement(strValue));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private Object applyConditionalMapping(FieldMappingRule rule, Map<String, Object> source) {
        String condition = rule.getConditionExpression();
        if (condition == null || rule.getConditionTargets() == null) {
            return null;
        }

        String[] parts = condition.split("=", 2);
        if (parts.length < 2) {
            return null;
        }

        String sourceFieldName = parts[0];
        String expectedValue = parts[1];

        Object actualValue = source.get(sourceFieldName);
        String actualStr = actualValue != null ? actualValue.toString() : null;

        if (expectedValue.equals(actualStr)) {
            Map<String, String> targets = rule.getConditionTargets();
            for (Map.Entry<String, String> entry : targets.entrySet()) {
                Object targetValue = source.get(entry.getValue());
                return targetValue;
            }
        }
        return null;
    }

    private Object convertType(Object value, String targetType) {
        if (value == null) {
            return null;
        }
        try {
            switch (targetType.toUpperCase()) {
                case "DATE":
                    if (value instanceof String) {
                        return parseDate((String) value);
                    }
                    break;
                case "INTEGER":
                    if (value instanceof String) {
                        return Integer.parseInt((String) value);
                    }
                    break;
                case "DOUBLE":
                    if (value instanceof String) {
                        return Double.parseDouble((String) value);
                    } else if (value instanceof Integer) {
                        return ((Integer) value).doubleValue();
                    }
                    break;
                case "STRING":
                    if (value instanceof Date) {
                        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                        return sdf.format((Date) value);
                    }
                    return value.toString();
            }
        } catch (Exception e) {
            logger.error("Type conversion failed: {} -> {}", value, targetType);
        }
        return value;
    }

    private Date parseDate(String dateStr) throws ParseException {
        if (dateStr == null) {
            return null;
        }
        String[] patterns = {"yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"};
        for (String pattern : patterns) {
            try {
                return new SimpleDateFormat(pattern).parse(dateStr);
            } catch (ParseException ignored) {
            }
        }
        throw new ParseException("Unparseable date: " + dateStr, 0);
    }
}
