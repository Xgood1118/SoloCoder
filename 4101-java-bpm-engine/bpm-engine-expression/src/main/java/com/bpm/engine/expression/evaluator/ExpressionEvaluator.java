package com.bpm.engine.expression.evaluator;

import com.bpm.engine.common.enums.ExpressionType;

import java.util.Map;

public interface ExpressionEvaluator {

    ExpressionType getType();

    Object evaluate(String expression, Map<String, Object> variables);

    <T> T evaluate(String expression, Map<String, Object> variables, Class<T> resultType);

    boolean evaluateCondition(String expression, Map<String, Object> variables);
}
