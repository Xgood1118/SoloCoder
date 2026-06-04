package com.ecommerce.order.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "order_status_logs")
public class OrderStatusLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column
    @Enumerated(EnumType.STRING)
    private OrderStatus fromStatus;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderStatus toStatus;

    @Column(nullable = false)
    private LocalDateTime changedAt;

    @Column(nullable = false, length = 100)
    private String changedBy;

    @Column(length = 500)
    private String remark;
}
