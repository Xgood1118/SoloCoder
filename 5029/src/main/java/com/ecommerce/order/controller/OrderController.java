package com.ecommerce.order.controller;

import com.ecommerce.common.ApiResponse;
import com.ecommerce.order.dto.OrderCreateRequest;
import com.ecommerce.order.dto.OrderStatusChangeRequest;
import com.ecommerce.order.entity.Order;
import com.ecommerce.order.entity.OrderStatus;
import com.ecommerce.order.entity.OrderStatusLog;
import com.ecommerce.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ApiResponse<Order> createOrder(@Valid @RequestBody OrderCreateRequest request) {
        return ApiResponse.success(orderService.createOrder(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<Order> getOrder(@PathVariable Long id) {
        return ApiResponse.success(orderService.getOrder(id));
    }

    @GetMapping("/no/{orderNo}")
    public ApiResponse<Order> getOrderByNo(@PathVariable String orderNo) {
        return ApiResponse.success(orderService.getOrderByNo(orderNo));
    }

    @GetMapping
    public ApiResponse<List<Order>> listOrders() {
        return ApiResponse.success(orderService.listOrders());
    }

    @GetMapping("/status/{status}")
    public ApiResponse<List<Order>> listOrdersByStatus(@PathVariable OrderStatus status) {
        return ApiResponse.success(orderService.listOrdersByStatus(status));
    }

    @PostMapping("/{id}/pay")
    public ApiResponse<Order> payOrder(@PathVariable Long id, @RequestBody OrderStatusChangeRequest.StatusChange request) {
        return ApiResponse.success(orderService.payOrder(id, request));
    }

    @PostMapping("/{id}/confirm-payment")
    public ApiResponse<Order> confirmPayment(@PathVariable Long id, @RequestBody OrderStatusChangeRequest.StatusChange request) {
        return ApiResponse.success(orderService.confirmPayment(id, request));
    }

    @PostMapping("/{id}/ship")
    public ApiResponse<Order> shipOrder(@PathVariable Long id, @RequestBody OrderStatusChangeRequest.StatusChange request) {
        return ApiResponse.success(orderService.shipOrder(id, request));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<Order> completeOrder(@PathVariable Long id, @RequestBody OrderStatusChangeRequest.StatusChange request) {
        return ApiResponse.success(orderService.completeOrder(id, request));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<Order> cancelOrder(@PathVariable Long id, @RequestBody OrderStatusChangeRequest.StatusChange request) {
        return ApiResponse.success(orderService.cancelOrder(id, request));
    }

    @GetMapping("/{id}/status-logs")
    public ApiResponse<List<OrderStatusLog>> getOrderStatusLogs(@PathVariable Long id) {
        return ApiResponse.success(orderService.getOrderStatusLogs(id));
    }
}
