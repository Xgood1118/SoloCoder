package com.ordersystem.common.points;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class MockPointsService implements PointsService {

    @Override
    public void deductPoints(String userId, int amount) {
        log.info("[Mock] deductPoints: userId={}, amount={}", userId, amount);
    }

    public void restorePoints(String userId, int amount) {
        log.info("[Mock] restorePoints: userId={}, amount={}", userId, amount);
    }
}
