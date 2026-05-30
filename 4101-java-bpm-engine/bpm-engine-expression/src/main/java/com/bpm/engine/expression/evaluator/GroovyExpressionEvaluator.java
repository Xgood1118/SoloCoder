package com.bpm.engine.expression.evaluator;

import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ExpressionEvaluationException;
import org.springframework.stereotype.Component;

import javax.script.Bindings;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import java.util.Map;

@Component
public class GroovyExpressionEvaluator implements ExpressionEvaluator {

    private final ScriptEngine groovyEngine;

    public GroovyExpressionEvaluator() {
        ScriptEngineManager manager = new ScriptEngineManager();
        this.groovyEngine = manager.getEngineByName("groovy");
        if (this.groovyEngine == null) {
            throw new IllegalStateException("Groovy script engine not available");
        }
    }

    @Override
    public ExpressionType getType() {
        return ExpressionType.GROOVY;
    }

    @Override
    public Object evaluate(String expression, Map<String, Object> variables) {
        try {
            Bindings bindings = createBindings(variables);
            return groovyEngine.eval(expression, bindings);
        } catch (Exception e) {
            throw new ExpressionEvaluationException("GROOVY_EVAL_ERROR", "Failed to evaluate Groovy expression: " + expression, e);
        }
    }

    @Override
    public <T> T evaluate(String expression, Map<String, Object> variables, Class<T> resultType) {
        try {
            Bindings bindings = createBindings(variables);
            Object result = groovyEngine.eval(expression, bindings);
            if (result == null) {
                return null;
            }
            return castResult(result, resultType);
        } catch (Exception e) {
            throw new ExpressionEvaluationException("GROOVY_EVAL_ERROR", "Failed to evaluate Groovy expression: " + expression, e);
        }
    }

    @Override
    public boolean evaluateCondition(String expression, Map<String, Object> variables) {
        try {
            Bindings bindings = createBindings(variables);
            Object result = groovyEngine.eval(expression, bindings);
            if (result instanceof Boolean) {
                return (Boolean) result;
            }
            throw new ExpressionEvaluationException("GROOVY_CONDITION_ERROR",
                    "Groovy condition did not return boolean: " + expression);
        } catch (ExpressionEvaluationException e) {
            throw e;
        } catch (Exception e) {
            throw new ExpressionEvaluationException("GROOVY_CONDITION_ERROR",
                    "Failed to evaluate Groovy condition: " + expression, e);
        }
    }

    private Bindings createBindings(Map<String, Object> variables) {
        Bindings bindings = groovyEngine.createBindings();
        if (variables != null) {
            variables.forEach(bindings::put);
        }
        return bindings;
    }

    @SuppressWarnings("unchecked")
    private <T> T castResult(Object result, Class<T> resultType) {
        if (resultType.isInstance(result)) {
            return resultType.cast(result);
        }
        return (T) result;
    }
}
