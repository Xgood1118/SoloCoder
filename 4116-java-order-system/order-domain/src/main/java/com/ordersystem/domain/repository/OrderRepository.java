package com.ordersystem.domain.repository;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.domain.model.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

@Mapper
public interface OrderRepository extends BaseMapper<Order> {

    default Order save(Order order) {
        if (order.getOrderId() == null) {
            insert(order);
        } else {
            updateById(order);
        }
        return order;
    }

    default Optional<Order> findById(String orderId) {
        return Optional.ofNullable(selectById(orderId));
    }

    default Optional<Order> findByOrderNo(String orderNo) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<Order>()
                .eq(Order::getOrderNo, orderNo)));
    }

    default Order update(Order order) {
        updateById(order);
        return order;
    }

    @Select("SELECT * FROM t_order WHERE order_id = #{orderId} FOR UPDATE")
    Optional<Order> findByIdForUpdate(String orderId);
}
