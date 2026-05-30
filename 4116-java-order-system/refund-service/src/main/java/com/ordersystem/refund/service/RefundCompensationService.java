package com.ordersystem.refund.service;

import com.ordersystem.common.coupon.CouponService;
import com.ordersystem.common.points.PointsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class RefundCompensationService {

    private final PointsService pointsService;
    private final CouponService couponService;

    public RefundCompensationService(PointsService pointsService,
                                      CouponService couponService) {
        this.pointsService = pointsService;
        this.couponService = couponService;
    }

    public void rollbackInventory(String orderNo, String orderItemId) {
        log.info("rollbackInventory stub: orderNo={}, orderItemId={}", orderNo, orderItemId);
    }

    public void rollbackPoints(String userId, int amount) {
        log.info("rollbackPoints stub: userId={}, amount={}", userId, amount);
    }

    public void rollbackCoupon(String userId, String couponId) {
        log.info("rollbackCoupon stub: userId={}, couponId={}", userId, couponId);
    }
}
