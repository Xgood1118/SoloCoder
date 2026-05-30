package com.ordersystem.payment.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.payment.model.PaymentOrder;
import com.ordersystem.payment.model.PaymentStatus;
import org.apache.ibatis.annotations.Mapper;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface PaymentOrderRepository extends BaseMapper<PaymentOrder> {

    default PaymentOrder findByPaymentId(String paymentId) {
        return selectById(paymentId);
    }

    default PaymentOrder findByOrderNo(String orderNo) {
        return selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<PaymentOrder>()
                .eq(PaymentOrder::getOrderNo, orderNo)
                .orderByDesc(PaymentOrder::getCreatedAt)
                .last("LIMIT 1"));
    }

    default List<PaymentOrder> findByStatusAndExpireTimeBefore(PaymentStatus status, LocalDateTime expireTime) {
        return selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<PaymentOrder>()
                .eq(PaymentOrder::getStatus, status)
                .le(PaymentOrder::getExpireTime, expireTime));
    }

    default boolean existsByCallbackNo(String callbackNo) {
        return exists(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<PaymentOrder>()
                .eq(PaymentOrder::getCallbackNo, callbackNo));
    }

    default PaymentOrder save(PaymentOrder order) {
        if (order.getPaymentId() == null) {
            insert(order);
        } else {
            updateById(order);
        }
        return order;
    }
}
