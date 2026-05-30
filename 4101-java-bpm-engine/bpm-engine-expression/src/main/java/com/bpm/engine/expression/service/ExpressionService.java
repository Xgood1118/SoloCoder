package com.bpm.engine.expression.service;

import com.bpm.engine.common.enums.ExpressionType;

import java.util.Map;

public interface ExpressionService {

    Object evaluate(String expression, ExpressionType type, Map<String, Object> variables);

    <T> T evaluate(String expression, ExpressionType type, Map<String, Object> variables, Class<T> resultType);

    boolean evaluateCondition(String expression, ExpressionType type, Map<String, Object> variables);

    Object evaluateWithSandbox(String expression, ExpressionType type, Map<String, Object> variables);
}
