package com.ordersystem.query.cache;

import com.ordersystem.common.result.PageResult;
import com.ordersystem.query.model.OrderDetailVO;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class OrderCacheManager {

    private static final String ORDER_DETAIL_PREFIX = "order:detail:";
    private static final String ORDER_LIST_PREFIX = "order:list:";
    private static final long DETAIL_TTL_HOURS = 2;
    private static final long LIST_TTL_MINUTES = 30;

    private final RedisTemplate<String, Object> redisTemplate;

    public void cacheOrderDetail(OrderDetailVO orderDetail) {
        String key = ORDER_DETAIL_PREFIX + orderDetail.getOrderNo();
        redisTemplate.opsForValue().set(key, orderDetail, DETAIL_TTL_HOURS, TimeUnit.HOURS);
    }

    public OrderDetailVO getOrderDetail(String orderNo) {
        String key = ORDER_DETAIL_PREFIX + orderNo;
        return (OrderDetailVO) redisTemplate.opsForValue().get(key);
    }

    public void evictOrderDetail(String orderNo) {
        String key = ORDER_DETAIL_PREFIX + orderNo;
        redisTemplate.delete(key);
    }

    public void cacheOrderList(String cacheKey, PageResult<OrderDetailVO> pageResult) {
        String key = ORDER_LIST_PREFIX + cacheKey;
        redisTemplate.opsForValue().set(key, pageResult, LIST_TTL_MINUTES, TimeUnit.MINUTES);
    }

    @SuppressWarnings("unchecked")
    public PageResult<OrderDetailVO> getOrderList(String cacheKey) {
        String key = ORDER_LIST_PREFIX + cacheKey;
        return (PageResult<OrderDetailVO>) redisTemplate.opsForValue().get(key);
    }
}
