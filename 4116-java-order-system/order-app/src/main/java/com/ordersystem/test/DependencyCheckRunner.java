package com.ordersystem.test;

import com.ordersystem.common.coupon.CouponService;
import com.ordersystem.common.id.IdGenerator;
import com.ordersystem.common.points.PointsService;
import com.ordersystem.domain.factory.OrderFactory;
import com.ordersystem.query.repository.OrderQueryRepository;
import com.ordersystem.query.repository.OrderStatusHistoryRepository;
import com.ordersystem.refund.service.RefundCompensationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DependencyCheckRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DependencyCheckRunner.class);

    private final OrderFactory orderFactory;
    private final IdGenerator idGenerator;
    private final RefundCompensationService refundCompensationService;
    private final PointsService pointsService;
    private final CouponService couponService;
    private final OrderQueryRepository orderQueryRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;

    @Autowired
    public DependencyCheckRunner(OrderFactory orderFactory,
                                  IdGenerator idGenerator,
                                  RefundCompensationService refundCompensationService,
                                  PointsService pointsService,
                                  CouponService couponService,
                                  OrderQueryRepository orderQueryRepository,
                                  OrderStatusHistoryRepository orderStatusHistoryRepository) {
        this.orderFactory = orderFactory;
        this.idGenerator = idGenerator;
        this.refundCompensationService = refundCompensationService;
        this.pointsService = pointsService;
        this.couponService = couponService;
        this.orderQueryRepository = orderQueryRepository;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
    }

    @Override
    public void run(String... args) {
        log.info("========== Dependency Injection Check ==========");
        log.info("✅ OrderFactory: {}", orderFactory != null ? "OK" : "MISSING");
        log.info("✅ IdGenerator: {}", idGenerator != null ? "OK" : "MISSING");
        log.info("✅ RefundCompensationService: {}", refundCompensationService != null ? "OK" : "MISSING");
        log.info("✅ PointsService: {}", pointsService != null ? "OK" : "MISSING");
        log.info("✅ CouponService: {}", couponService != null ? "OK" : "MISSING");
        log.info("✅ OrderQueryRepository: {}", orderQueryRepository != null ? "OK" : "MISSING");
        log.info("✅ OrderStatusHistoryRepository: {}", orderStatusHistoryRepository != null ? "OK" : "MISSING");
        log.info("========== All Dependencies Injected OK! ==========");
    }
}
