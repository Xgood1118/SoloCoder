package com.bpm.engine.expression.service;

import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ExpressionEvaluationException;
import com.bpm.engine.expression.evaluator.ExpressionEvaluator;
import com.bpm.engine.expression.error.ExpressionErrorRecorder;
import com.bpm.engine.expression.sandbox.ExpressionSandboxInterceptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ExpressionServiceImpl implements ExpressionService {

    private static final Logger log = LoggerFactory.getLogger(ExpressionServiceImpl.class);

    private final Map<ExpressionType, ExpressionEvaluator> evaluatorMap;
    private final ExpressionSandboxInterceptor sandboxInterceptor;
    private final ExpressionErrorRecorder errorRecorder;

    public ExpressionServiceImpl(List<ExpressionEvaluator> evaluators,
                                 ExpressionSandboxInterceptor sandboxInterceptor,
                                 ExpressionErrorRecorder errorRecorder) {
        this.evaluatorMap = evaluators.stream()
                .collect(Collectors.toMap(ExpressionEvaluator::getType, Function.identity()));
        this.sandboxInterceptor = sandboxInterceptor;
        this.errorRecorder = errorRecorder;
    }

    @Override
    public Object evaluate(String expression, ExpressionType type, Map<String, Object> variables) {
        ExpressionEvaluator evaluator = getEvaluator(type);
        try {
            return evaluator.evaluate(expression, variables);
        } catch (Exception e) {
            errorRecorder.record(expression, type, e);
            log.error("Expression evaluation failed - type: {}, expression: {}, error: {}",
                    type, expression, e.getMessage());
            throw e;
        }
    }

    @Override
    public <T> T evaluate(String expression, ExpressionType type, Map<String, Object> variables, Class<T> resultType) {
        ExpressionEvaluator evaluator = getEvaluator(type);
        try {
            return evaluator.evaluate(expression, variables, resultType);
        } catch (Exception e) {
            errorRecorder.record(expression, type, e);
            log.error("Expression evaluation failed - type: {}, expression: {}, error: {}",
                    type, expression, e.getMessage());
            throw e;
        }
    }

    @Override
    public boolean evaluateCondition(String expression, ExpressionType type, Map<String, Object> variables) {
        ExpressionEvaluator evaluator = getEvaluator(type);
        try {
            return evaluator.evaluateCondition(expression, variables);
        } catch (Exception e) {
            errorRecorder.record(expression, type, e);
            log.error("Expression condition evaluation failed - type: {}, expression: {}, error: {}",
                    type, expression, e.getMessage());
            throw e;
        }
    }

    @Override
    public Object evaluateWithSandbox(String expression, ExpressionType type, Map<String, Object> variables) {
        try {
            return sandboxInterceptor.evaluateWithSandbox(expression, type, variables);
        } catch (Exception e) {
            errorRecorder.record(expression, type, e);
            log.error("Sandbox expression evaluation failed - type: {}, expression: {}, error: {}",
                    type, expression, e.getMessage());
            throw e;
        }
    }

    private ExpressionEvaluator getEvaluator(ExpressionType type) {
        ExpressionEvaluator evaluator = evaluatorMap.get(type);
        if (evaluator == null) {
            throw new ExpressionEvaluationException("UNSUPPORTED_EXPRESSION_TYPE",
                    "No evaluator found for expression type: " + type);
        }
        return evaluator;
    }
}
