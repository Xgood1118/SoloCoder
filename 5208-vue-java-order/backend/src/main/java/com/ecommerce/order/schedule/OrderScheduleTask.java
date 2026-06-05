package com.ecommerce.order.schedule;

import com.ecommerce.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderScheduleTask {
    private final OrderService orderService;

    @Scheduled(cron = "0 * * * * ?")
    public void processExpiredOrders() {
        log.debug("开始处理超时未支付订单");
        orderService.processExpiredOrders();
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void processAutoConfirm() {
        log.debug("开始处理超时时自动确认收货订单");
        orderService.processAutoConfirm();
    }
}
