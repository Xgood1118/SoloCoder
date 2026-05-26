package com.cacheproxy.core;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.util.DigestUtils;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

public class CacheKeyGenerator {

    private static final ExpressionParser EXPRESSION_PARSER = new SpelExpressionParser();
    private static final ParameterNameDiscoverer PARAMETER_NAME_DISCOVERER = new DefaultParameterNameDiscoverer();
    private static final String KEY_SEPARATOR = ":";

    public static String generateKey(String prefix, String keyExpression, ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object[] args = joinPoint.getArgs();
        String[] paramNames = PARAMETER_NAME_DISCOVERER.getParameterNames(method);

        String generatedKey;

        if (StringUtils.hasText(keyExpression)) {
            generatedKey = parseSpel(keyExpression, paramNames, args);
        } else {
            generatedKey = generateDefaultKey(method, args);
        }

        if (StringUtils.hasText(prefix)) {
            return prefix + KEY_SEPARATOR + generatedKey;
        }
        return generatedKey;
    }

    private static String parseSpel(String expression, String[] paramNames, Object[] args) {
        EvaluationContext context = new StandardEvaluationContext();

        if (paramNames != null && args != null) {
            for (int i = 0; i < paramNames.length; i++) {
                context.setVariable(paramNames[i], args[i]);
            }
            for (int i = 0; i < args.length; i++) {
                context.setVariable("p" + i, args[i]);
            }
        }

        Expression exp = EXPRESSION_PARSER.parseExpression(expression);
        Object result = exp.getValue(context);
        return result != null ? result.toString() : "null";
    }

    private static String generateDefaultKey(Method method, Object[] args) {
        String methodKey = method.getDeclaringClass().getName() + "." + method.getName();
        String argsKey = args == null || args.length == 0
                ? "[]"
                : Arrays.stream(args)
                        .map(arg -> arg == null ? "null" : arg.toString())
                        .collect(Collectors.joining(","));

        String rawKey = methodKey + "(" + argsKey + ")";
        return DigestUtils.md5DigestAsHex(rawKey.getBytes());
    }

    public static String generateCacheName(Method method, String prefix) {
        if (StringUtils.hasText(prefix)) {
            return prefix;
        }
        return method.getDeclaringClass().getName() + "." + method.getName();
    }
}
