package com.bpm.engine.expression.evaluator;

import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ExpressionEvaluationException;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SpelExpressionEvaluator implements ExpressionEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();

    @Override
    public ExpressionType getType() {
        return ExpressionType.SPEL;
    }

    @Override
    public Object evaluate(String expression, Map<String, Object> variables) {
        try {
            StandardEvaluationContext context = createEvaluationContext(variables);
            Expression expr = parser.parseExpression(expression);
            return expr.getValue(context);
        } catch (Exception e) {
            throw new ExpressionEvaluationException("SPEL_EVAL_ERROR", "Failed to evaluate SpEL expression: " + expression, e);
        }
    }

    @Override
    public <T> T evaluate(String expression, Map<String, Object> variables, Class<T> resultType) {
        try {
            StandardEvaluationContext context = createEvaluationContext(variables);
            Expression expr = parser.parseExpression(expression);
            return expr.getValue(context, resultType);
        } catch (Exception e) {
            throw new ExpressionEvaluationException("SPEL_EVAL_ERROR", "Failed to evaluate SpEL expression: " + expression, e);
        }
    }

    @Override
    public boolean evaluateCondition(String expression, Map<String, Object> variables) {
        try {
            StandardEvaluationContext context = createEvaluationContext(variables);
            Expression expr = parser.parseExpression(expression);
            Boolean result = expr.getValue(context, Boolean.class);
            return result != null && result;
        } catch (Exception e) {
            throw new ExpressionEvaluationException("SPEL_CONDITION_ERROR", "Failed to evaluate SpEL condition: " + expression, e);
        }
    }

    private StandardEvaluationContext createEvaluationContext(Map<String, Object> variables) {
        StandardEvaluationContext context = new StandardEvaluationContext();
        if (variables != null) {
            variables.forEach(context::setVariable);
        }
        return context;
    }
}
