package com.etl.cleaning;

import java.util.Map;

public class ConditionEvaluator {

    public static boolean evaluate(String conditionExpression, Map<String, Object> record) {
        if (conditionExpression == null || conditionExpression.trim().isEmpty()) {
            return true;
        }

        String[] operators = {">=", "<=", "!=", "==", ">", "<"};
        String foundOperator = null;
        int operatorIndex = -1;

        for (String op : operators) {
            int idx = conditionExpression.indexOf(op);
            if (idx >= 0) {
                foundOperator = op;
                operatorIndex = idx;
                break;
            }
        }

        if (foundOperator == null) {
            return false;
        }

        String fieldName = conditionExpression.substring(0, operatorIndex).trim();
        String conditionValue = conditionExpression.substring(operatorIndex + foundOperator.length()).trim();

        Object fieldValue = record.get(fieldName);

        if (fieldValue == null) {
            switch (foundOperator) {
                case "==":
                    return conditionValue.equals("null") || conditionValue.equals("NULL");
                case "!=":
                    return !conditionValue.equals("null") && !conditionValue.equals("NULL");
                default:
                    return false;
            }
        }

        try {
            double fieldDouble = Double.parseDouble(fieldValue.toString());
            double conditionDouble = Double.parseDouble(conditionValue);

            switch (foundOperator) {
                case "==":
                    return fieldDouble == conditionDouble;
                case "!=":
                    return fieldDouble != conditionDouble;
                case ">":
                    return fieldDouble > conditionDouble;
                case "<":
                    return fieldDouble < conditionDouble;
                case ">=":
                    return fieldDouble >= conditionDouble;
                case "<=":
                    return fieldDouble <= conditionDouble;
                default:
                    return false;
            }
        } catch (NumberFormatException e) {
            String fieldStr = fieldValue.toString();
            switch (foundOperator) {
                case "==":
                    return fieldStr.equals(conditionValue);
                case "!=":
                    return !fieldStr.equals(conditionValue);
                case ">":
                    return fieldStr.compareTo(conditionValue) > 0;
                case "<":
                    return fieldStr.compareTo(conditionValue) < 0;
                case ">=":
                    return fieldStr.compareTo(conditionValue) >= 0;
                case "<=":
                    return fieldStr.compareTo(conditionValue) <= 0;
                default:
                    return false;
            }
        }
    }
}
