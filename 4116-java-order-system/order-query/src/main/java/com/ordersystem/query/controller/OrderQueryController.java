package com.ordersystem.query.controller;

import com.ordersystem.common.result.PageResult;
import com.ordersystem.query.model.OrderDetailVO;
import com.ordersystem.query.model.OrderQueryCondition;
import com.ordersystem.query.model.OrderStatusHistory;
import com.ordersystem.query.service.OrderQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderQueryController {

    private final OrderQueryService orderQueryService;

    @GetMapping
    public PageResult<OrderDetailVO> queryOrders(OrderQueryCondition condition) {
        return orderQueryService.queryOrders(condition);
    }

    @GetMapping("/{orderNo}")
    public OrderDetailVO getOrderDetail(@PathVariable String orderNo) {
        return orderQueryService.getOrderDetail(orderNo);
    }

    @GetMapping("/{orderNo}/history")
    public List<OrderStatusHistory> getStatusHistory(@PathVariable String orderNo) {
        return orderQueryService.getStatusHistory(orderNo);
    }
}
