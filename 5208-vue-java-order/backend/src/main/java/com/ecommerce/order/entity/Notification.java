package com.ecommerce.order.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    private String id;
    private String userId;
    private String title;
    private String content;
    private String orderId;
    private boolean read;
    private LocalDateTime createdAt;
}
