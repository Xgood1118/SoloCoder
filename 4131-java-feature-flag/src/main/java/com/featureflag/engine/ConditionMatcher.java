package com.featureflag.engine;

import com.featureflag.entity.RuleCondition;
import com.featureflag.enums.ConditionOperator;
import com.featureflag.dto.UserContext;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class ConditionMatcher {

    public boolean matchCondition(RuleCondition condition, UserContext userContext) {
        String attributeName = condition.getAttributeName();
        Object actualValue = getAttributeValue(attributeName, userContext);
        String expectedValue = condition.getAttributeValue();
        ConditionOperator operator = condition.getOperator();

        return evaluateCondition(actualValue, expectedValue, operator, condition.getValueType());
    }

    private Object getAttributeValue(String attributeName, UserContext userContext) {
        if (userContext == null) {
            return null;
        }

        if ("userId".equals(attributeName)) {
            return userContext.getUserId();
        }
        if ("userTags".equals(attributeName)) {
            return userContext.getUserTags();
        }

        return userContext.getAttribute(attributeName);
    }

    @SuppressWarnings("unchecked")
    private boolean evaluateCondition(Object actualValue, String expectedValue, ConditionOperator operator, String valueType) {
        switch (operator) {
            case EQUALS:
                return isEquals(actualValue, expectedValue, valueType);
            case NOT_EQUALS:
                return !isEquals(actualValue, expectedValue, valueType);
            case GREATER_THAN:
                return compare(actualValue, expectedValue, valueType) > 0;
            case LESS_THAN:
                return compare(actualValue, expectedValue, valueType) < 0;
            case GREATER_THAN_OR_EQUALS:
                return compare(actualValue, expectedValue, valueType) >= 0;
            case LESS_THAN_OR_EQUALS:
                return compare(actualValue, expectedValue, valueType) <= 0;
            case CONTAINS:
                return actualValue != null && String.valueOf(actualValue).contains(expectedValue);
            case NOT_CONTAINS:
                return actualValue == null || !String.valueOf(actualValue).contains(expectedValue);
            case IN:
                return isInList(actualValue, expectedValue, valueType);
            case NOT_IN:
                return !isInList(actualValue, expectedValue, valueType);
            case REGEX:
                return actualValue != null && Pattern.matches(expectedValue, String.valueOf(actualValue));
            default:
                return false;
        }
    }

    private boolean isEquals(Object actualValue, String expectedValue, String valueType) {
        if (actualValue == null) {
            return expectedValue == null || "null".equalsIgnoreCase(expectedValue);
        }
        Object convertedExpected = convertValue(expectedValue, valueType);
        return actualValue.equals(convertedExpected);
    }

    private int compare(Object actualValue, String expectedValue, String valueType) {
        if (actualValue == null) {
            return -1;
        }
        try {
            double actual = ((Number) actualValue).doubleValue();
            double expected = Double.parseDouble(expectedValue);
            return Double.compare(actual, expected);
        } catch (Exception e) {
            return String.valueOf(actualValue).compareTo(expectedValue);
        }
    }

    private boolean isInList(Object actualValue, String expectedValue, String valueType) {
        if (actualValue == null) {
            return false;
        }
        List<String> values = Arrays.asList(expectedValue.split(","));
        Object convertedActual = convertValue(String.valueOf(actualValue), valueType);
        return values.stream().anyMatch(v -> convertValue(v.trim(), valueType).equals(convertedActual));
    }

    private Object convertValue(String value, String valueType) {
        if (value == null) {
            return null;
        }
        try {
            switch (valueType.toLowerCase()) {
                case "int":
                case "integer":
                    return Integer.parseInt(value.trim());
                case "long":
                    return Long.parseLong(value.trim());
                case "double":
                    return Double.parseDouble(value.trim());
                case "boolean":
                    return Boolean.parseBoolean(value.trim());
                default:
                    return value.trim();
            }
        } catch (Exception e) {
            return value.trim();
        }
    }
}
