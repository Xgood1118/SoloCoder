package com.ordersystem.query.aspect;

import com.ordersystem.domain.model.OrderStatus;
import com.ordersystem.query.model.OrderStatusHistory;
import com.ordersystem.query.service.OrderQueryService;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Aspect
@Component
@RequiredArgsConstructor
public class StatusHistoryAspect {

    private final OrderQueryService orderQueryService;

    @Around("execution(* com.ordersystem.domain.service.*.changeStatus(..))")
    public Object recordStatusHistory(ProceedingJoinPoint joinPoint) throws Throwable {
        Object result = joinPoint.proceed();

        Object[] args = joinPoint.getArgs();
        if (args.length >= 3 && args[0] instanceof String orderNo
                && args[1] instanceof OrderStatus fromStatus
                && args[2] instanceof OrderStatus toStatus) {
            OrderStatusHistory history = new OrderStatusHistory();
            history.setOrderNo(orderNo);
            history.setFromStatus(fromStatus);
            history.setToStatus(toStatus);
            history.setOperator(args.length >= 4 && args[3] instanceof String op ? op : "system");
            history.setReason(args.length >= 5 && args[4] instanceof String r ? r : null);
            history.setOperatedAt(LocalDateTime.now());
            orderQueryService.saveStatusHistory(history);
        }

        return result;
    }
}
