package com.cacheproxy;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;

import java.lang.reflect.Method;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class MockJoinPoint {

    public static ProceedingJoinPoint create(Method method, Object target, Object... args) {
        ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);
        MethodSignature signature = mock(MethodSignature.class);

        when(joinPoint.getSignature()).thenReturn(signature);
        when(joinPoint.getArgs()).thenReturn(args);
        when(joinPoint.getTarget()).thenReturn(target);
        when(signature.getMethod()).thenReturn(method);
        when(signature.getDeclaringType()).thenReturn(method.getDeclaringClass());
        when(signature.getName()).thenReturn(method.getName());
        when(signature.getParameterTypes()).thenReturn(method.getParameterTypes());

        return joinPoint;
    }
}
