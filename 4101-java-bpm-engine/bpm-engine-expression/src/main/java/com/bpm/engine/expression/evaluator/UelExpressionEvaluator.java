package com.bpm.engine.expression.evaluator;

import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ExpressionEvaluationException;
import jakarta.el.*;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class UelExpressionEvaluator implements ExpressionEvaluator {

    private final ExpressionFactory expressionFactory;

    public UelExpressionEvaluator() {
        this.expressionFactory = ExpressionFactory.newInstance();
    }

    @Override
    public ExpressionType getType() {
        return ExpressionType.UEL;
    }

    @Override
    public Object evaluate(String expression, Map<String, Object> variables) {
        try {
            ELContext context = createElContext(variables);
            ValueExpression valueExpression = expressionFactory.createValueExpression(
                    context, expression, Object.class);
            return valueExpression.getValue(context);
        } catch (Exception e) {
            throw new ExpressionEvaluationException("UEL_EVAL_ERROR", "Failed to evaluate UEL expression: " + expression, e);
        }
    }

    @Override
    public <T> T evaluate(String expression, Map<String, Object> variables, Class<T> resultType) {
        try {
            ELContext context = createElContext(variables);
            ValueExpression valueExpression = expressionFactory.createValueExpression(
                    context, expression, resultType);
            return resultType.cast(valueExpression.getValue(context));
        } catch (Exception e) {
            throw new ExpressionEvaluationException("UEL_EVAL_ERROR", "Failed to evaluate UEL expression: " + expression, e);
        }
    }

    @Override
    public boolean evaluateCondition(String expression, Map<String, Object> variables) {
        try {
            ELContext context = createElContext(variables);
            ValueExpression valueExpression = expressionFactory.createValueExpression(
                    context, expression, Boolean.class);
            Boolean result = (Boolean) valueExpression.getValue(context);
            return result != null && result;
        } catch (Exception e) {
            throw new ExpressionEvaluationException("UEL_CONDITION_ERROR", "Failed to evaluate UEL condition: " + expression, e);
        }
    }

    private ELContext createElContext(Map<String, Object> variables) {
        CompositeELResolver resolver = new CompositeELResolver();
        resolver.add(new ArrayELResolver());
        resolver.add(new ListELResolver());
        resolver.add(new MapELResolver());
        resolver.add(new BeanELResolver());

        VariableMapper variableMapper = new SimpleVariableMapper();
        if (variables != null) {
            variables.forEach((name, value) -> {
                ValueExpression ve = expressionFactory.createValueExpression(value, Object.class);
                variableMapper.setVariable(name, ve);
            });
        }

        return new SimpleELContext(resolver, variableMapper);
    }

    private static class SimpleVariableMapper extends VariableMapper {

        private final java.util.HashMap<String, ValueExpression> variables = new java.util.HashMap<>();

        @Override
        public ValueExpression resolveVariable(String name) {
            return variables.get(name);
        }

        @Override
        public ValueExpression setVariable(String name, ValueExpression expression) {
            if (expression == null) {
                return variables.remove(name);
            }
            return variables.put(name, expression);
        }
    }

    private static class SimpleELContext extends ELContext {

        private final CompositeELResolver resolver;
        private final VariableMapper variableMapper;
        private final FunctionMapper functionMapper;

        SimpleELContext(CompositeELResolver resolver, VariableMapper variableMapper) {
            this.resolver = resolver;
            this.variableMapper = variableMapper;
            this.functionMapper = new FunctionMapper() {
                @Override
                public java.lang.reflect.Method resolveFunction(String prefix, String localName) {
                    return null;
                }
            };
        }

        @Override
        public ELResolver getELResolver() {
            return resolver;
        }

        @Override
        public VariableMapper getVariableMapper() {
            return variableMapper;
        }

        @Override
        public FunctionMapper getFunctionMapper() {
            return functionMapper;
        }
    }
}
