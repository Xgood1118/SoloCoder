package com.bpm.engine.expression.sandbox;

import com.bpm.engine.common.enums.ExpressionType;
import com.bpm.engine.common.exception.ExpressionEvaluationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class ExpressionSandboxInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ExpressionSandboxInterceptor.class);

    private final SandboxConfig sandboxConfig;
    private final GroovySandbox groovySandbox;

    public ExpressionSandboxInterceptor(SandboxConfig sandboxConfig, GroovySandbox groovySandbox) {
        this.sandboxConfig = sandboxConfig;
        this.groovySandbox = groovySandbox;
    }

    public boolean isSandboxEnabled() {
        return sandboxConfig.isEnabled();
    }

    public Object evaluateWithSandbox(String expression, ExpressionType type, Map<String, Object> variables) {
        if (!sandboxConfig.isEnabled()) {
            return null;
        }

        return switch (type) {
            case GROOVY -> evaluateGroovySandboxed(expression, variables);
            case SPEL -> evaluateSpelSandboxed(expression, variables);
            case UEL -> evaluateWithOutputLimit(expression, type, variables);
        };
    }

    private Object evaluateGroovySandboxed(String expression, Map<String, Object> variables) {
        return groovySandbox.evaluateSandboxed(expression, variables);
    }

    private Object evaluateSpelSandboxed(String expression, Map<String, Object> variables) {
        try {
            SimpleEvaluationContext.Builder contextBuilder = SimpleEvaluationContext.forReadOnlyDataBinding();
            SimpleEvaluationContext context = contextBuilder.build();
            if (variables != null) {
                variables.forEach(context::setVariable);
            }

            ExpressionParser parser = new SpelExpressionParser();
            Expression expr = parser.parseExpression(expression);
            Object result = expr.getValue(context);

            return limitOutput(result);
        } catch (Exception e) {
            logSecurityViolation(expression, ExpressionType.SPEL, e);
            throw new ExpressionEvaluationException("SANDBOX_SPEL_VIOLATION",
                    "SpEL sandbox restriction: " + e.getMessage(), e);
        }
    }

    private Object evaluateWithOutputLimit(String expression, ExpressionType type, Map<String, Object> variables) {
        throw new ExpressionEvaluationException("SANDBOX_UEL_UNSUPPORTED",
                "UEL sandbox evaluation is not directly supported; use Groovy or SpEL for sandboxed execution");
    }

    private Object limitOutput(Object result) {
        if (result != null && result.toString().length() > sandboxConfig.getMaxOutputLength()) {
            throw new ExpressionEvaluationException("SANDBOX_OUTPUT_LIMIT",
                    "Output exceeded maximum length of " + sandboxConfig.getMaxOutputLength());
        }
        return result;
    }

    private void logSecurityViolation(String expression, ExpressionType type, Exception e) {
        log.warn("Expression sandbox security violation - type: {}, expression: {}, error: {}",
                type, expression, e.getMessage());
    }
}
