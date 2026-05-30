package com.ordersystem;

import com.ordersystem.common.coupon.CouponService;
import com.ordersystem.common.id.IdGenerator;
import com.ordersystem.common.points.PointsService;
import com.ordersystem.config.TestInfrastructureConfig;
import com.ordersystem.domain.factory.OrderFactory;
import com.ordersystem.query.repository.OrderQueryRepository;
import com.ordersystem.query.repository.OrderStatusHistoryRepository;
import com.ordersystem.refund.service.RefundCompensationService;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.context.annotation.Import;
import com.ordersystem.inventory.config.RedissonScriptConfig;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
@Import(TestInfrastructureConfig.class)
@ComponentScan(excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RedissonScriptConfig.class))
public class DependencyInjectionTest {

    private static final Logger log = LoggerFactory.getLogger(DependencyInjectionTest.class);

    @Autowired(required = false)
    private OrderFactory orderFactory;

    @Autowired(required = false)
    private IdGenerator idGenerator;

    @Autowired(required = false)
    private RefundCompensationService refundCompensationService;

    @Autowired(required = false)
    private PointsService pointsService;

    @Autowired(required = false)
    private CouponService couponService;

    @Autowired(required = false)
    private OrderQueryRepository orderQueryRepository;

    @Autowired(required = false)
    private OrderStatusHistoryRepository orderStatusHistoryRepository;

    @Test
    void testAllDependenciesInjected() {
        log.info("========== Dependency Injection Test ==========");
        log.info("OrderFactory: {}", orderFactory != null ? "✅ OK" : "❌ MISSING");
        log.info("IdGenerator: {}", idGenerator != null ? "✅ OK" : "❌ MISSING");
        log.info("RefundCompensationService: {}", refundCompensationService != null ? "✅ OK" : "❌ MISSING");
        log.info("PointsService: {}", pointsService != null ? "✅ OK" : "❌ MISSING");
        log.info("CouponService: {}", couponService != null ? "✅ OK" : "❌ MISSING");
        log.info("OrderQueryRepository: {}", orderQueryRepository != null ? "✅ OK" : "❌ MISSING");
        log.info("OrderStatusHistoryRepository: {}", orderStatusHistoryRepository != null ? "✅ OK" : "❌ MISSING");

        assertNotNull(orderFactory, "OrderFactory should be injected");
        assertNotNull(idGenerator, "IdGenerator should be injected");
        assertNotNull(refundCompensationService, "RefundCompensationService should be injected");
        assertNotNull(pointsService, "PointsService should be injected");
        assertNotNull(couponService, "CouponService should be injected");
        assertNotNull(orderQueryRepository, "OrderQueryRepository should be injected");
        assertNotNull(orderStatusHistoryRepository, "OrderStatusHistoryRepository should be injected");

        log.info("========== All Dependencies Injected Successfully! ==========");
    }
}
