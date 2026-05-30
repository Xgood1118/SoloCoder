package com.ordersystem.query.repository;

import com.ordersystem.query.model.OrderStatusHistory;

import java.util.List;

public interface OrderStatusHistoryRepository {

    void save(OrderStatusHistory history);

    List<OrderStatusHistory> findByOrderNo(String orderNo);
}
