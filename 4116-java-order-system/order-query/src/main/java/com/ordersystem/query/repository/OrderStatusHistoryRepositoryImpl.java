package com.ordersystem.query.repository;

import com.ordersystem.query.model.OrderStatusHistory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class OrderStatusHistoryRepositoryImpl implements OrderStatusHistoryRepository {

    private final OrderQueryMapper orderQueryMapper;

    @Override
    public void save(OrderStatusHistory history) {
        orderQueryMapper.insertStatusHistory(history);
    }

    @Override
    public List<OrderStatusHistory> findByOrderNo(String orderNo) {
        return orderQueryMapper.findStatusHistory(orderNo);
    }
}
