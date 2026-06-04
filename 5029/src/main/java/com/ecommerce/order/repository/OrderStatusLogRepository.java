package com.ecommerce.order.repository;

import com.ecommerce.order.entity.OrderStatusLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderStatusLogRepository extends JpaRepository<OrderStatusLog, Long> {

    List<OrderStatusLog> findByOrderIdOrderByChangedAtAsc(Long orderId);
}
