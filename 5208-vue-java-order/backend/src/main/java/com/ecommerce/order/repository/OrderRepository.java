package com.ecommerce.order.repository;

import com.ecommerce.order.entity.*;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Repository
public class OrderRepository {
    private final Map<String, Order> orders = new ConcurrentHashMap<>();
    private final Map<String, OrderLog> orderLogs = new ConcurrentHashMap<>();
    private final Map<String, Notification> notifications = new ConcurrentHashMap<>();
    private final Map<String, RefundApplication> refundApplications = new ConcurrentHashMap<>();

    public Order save(Order order) {
        orders.put(order.getId(), order);
        return order;
    }

    public Optional<Order> findById(String id) {
        return Optional.ofNullable(orders.get(id));
    }

    public Optional<Order> findByOrderNo(String orderNo) {
        return orders.values().stream()
                .filter(o -> o.getOrderNo().equals(orderNo))
                .findFirst();
    }

    public List<Order> findAll() {
        return new ArrayList<>(orders.values());
    }

    public void deleteById(String id) {
        orders.remove(id);
    }

    public OrderLog saveLog(OrderLog log) {
        orderLogs.put(log.getId(), log);
        return log;
    }

    public List<OrderLog> findLogsByOrderId(String orderId) {
        return orderLogs.values().stream()
                .filter(log -> log.getOrderId().equals(orderId))
                .sorted(Comparator.comparing(OrderLog::getTimestamp).reversed())
                .collect(Collectors.toList());
    }

    public Notification saveNotification(Notification notification) {
        notifications.put(notification.getId(), notification);
        return notification;
    }

    public List<Notification> findNotificationsByUserId(String userId) {
        return notifications.values().stream()
                .filter(n -> n.getUserId().equals(userId))
                .sorted(Comparator.comparing(Notification::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public RefundApplication saveRefundApplication(RefundApplication application) {
        refundApplications.put(application.getId(), application);
        return application;
    }

    public Optional<RefundApplication> findRefundApplicationById(String id) {
        return Optional.ofNullable(refundApplications.get(id));
    }

    public List<RefundApplication> findRefundApplicationsByOrderId(String orderId) {
        return refundApplications.values().stream()
                .filter(r -> r.getOrderId().equals(orderId))
                .sorted(Comparator.comparing(RefundApplication::getAppliedAt).reversed())
                .collect(Collectors.toList());
    }

    public Map<String, Order> getOrdersMap() {
        return orders;
    }
}
