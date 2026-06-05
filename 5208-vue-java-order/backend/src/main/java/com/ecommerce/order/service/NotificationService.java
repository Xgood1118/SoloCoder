package com.ecommerce.order.service;

import com.ecommerce.order.entity.Notification;
import com.ecommerce.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final OrderRepository orderRepository;

    public Notification createNotification(String userId, String title, String content, String orderId) {
        Notification notification = Notification.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .userId(userId)
                .title(title)
                .content(content)
                .orderId(orderId)
                .read(false)
                .createdAt(LocalDateTime.now())
                .build();
        return orderRepository.saveNotification(notification);
    }

    public List<Notification> getUserNotifications(String userId) {
        return orderRepository.findNotificationsByUserId(userId);
    }

    public long getUnreadCount(String userId) {
        return orderRepository.findNotificationsByUserId(userId).stream()
                .filter(n -> !n.isRead())
                .count();
    }
}
