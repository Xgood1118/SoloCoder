package com.ordersystem.query.repository;

import com.ordersystem.common.result.PageResult;
import com.ordersystem.query.model.OrderDetailVO;
import com.ordersystem.query.model.OrderQueryCondition;
import com.ordersystem.query.model.OrderStatusHistory;

import java.util.List;

public interface OrderQueryRepository {

    PageResult<OrderDetailVO> findByCondition(OrderQueryCondition condition);

    OrderDetailVO findDetailByOrderNo(String orderNo);

    List<OrderStatusHistory> findStatusHistory(String orderNo);
}
