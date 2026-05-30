package com.ordersystem.common.coupon;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class MockCouponService implements CouponService {

    @Override
    public void restoreCoupon(String userId, String couponId) {
        log.info("[Mock] restoreCoupon: userId={}, couponId={}", userId, couponId);
    }
}
