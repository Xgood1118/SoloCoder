package com.ordersystem.common.lock;

import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

@Aspect
@RequiredArgsConstructor
public class DistributedLockAspect {

    private final DistributedLock distributedLock;

    @Around("@annotation(com.ordersystem.common.lock.DistributedLockAnnotation)")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        DistributedLockAnnotation annotation = signature.getMethod().getAnnotation(DistributedLockAnnotation.class);
        String lockKey = parseKey(annotation.key(), signature.getParameterNames(), joinPoint.getArgs());
        boolean acquired = distributedLock.tryLock(lockKey, annotation.waitTime(), annotation.leaseTime(), annotation.timeUnit());
        if (!acquired) {
            throw new RuntimeException("Failed to acquire distributed lock: " + lockKey);
        }
        try {
            return joinPoint.proceed();
        } finally {
            distributedLock.unlock(lockKey);
        }
    }

    private String parseKey(String keyExpression, String[] paramNames, Object[] args) {
        ExpressionParser parser = new SpelExpressionParser();
        EvaluationContext context = new StandardEvaluationContext();
        for (int i = 0; i < paramNames.length; i++) {
            context.setVariable(paramNames[i], args[i]);
        }
        return parser.parseExpression(keyExpression).getValue(context, String.class);
    }
}
