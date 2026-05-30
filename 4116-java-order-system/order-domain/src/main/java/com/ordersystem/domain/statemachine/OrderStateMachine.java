package com.ordersystem.domain.statemachine;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.model.OrderStatus;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

public class OrderStateMachine {

    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = new EnumMap<>(OrderStatus.class);

    static {
        TRANSITIONS.put(OrderStatus.PENDING_PAYMENT, Set.of(OrderStatus.PAID, OrderStatus.CANCELLED));
        TRANSITIONS.put(OrderStatus.PAID, Set.of(OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.REFUNDING));
        TRANSITIONS.put(OrderStatus.SHIPPED, Set.of(OrderStatus.RECEIVED, OrderStatus.REFUNDING));
        TRANSITIONS.put(OrderStatus.RECEIVED, Set.of(OrderStatus.COMPLETED, OrderStatus.REFUNDING));
        TRANSITIONS.put(OrderStatus.COMPLETED, Set.of(OrderStatus.ARCHIVED));
        TRANSITIONS.put(OrderStatus.CANCELLED, Set.of(OrderStatus.ARCHIVED));
        TRANSITIONS.put(OrderStatus.REFUNDING, Set.of(OrderStatus.REFUNDED));
        TRANSITIONS.put(OrderStatus.REFUNDED, Set.of(OrderStatus.ARCHIVED));
        TRANSITIONS.put(OrderStatus.ARCHIVED, Collections.emptySet());
    }

    public boolean canTransit(OrderStatus from, OrderStatus to) {
        Set<OrderStatus> allowed = TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }

    public OrderStatus transit(OrderStatus from, OrderStatus to) {
        if (!canTransit(from, to)) {
            throw new BizException(CommonErrorCode.ORDER_STATUS_ERROR,
                    "订单状态不允许从 " + from.getDesc() + " 转换为 " + to.getDesc());
        }
        return to;
    }
}
