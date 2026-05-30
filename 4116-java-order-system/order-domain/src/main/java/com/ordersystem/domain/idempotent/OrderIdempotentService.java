package com.ordersystem.domain.idempotent;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.common.idempotent.IdempotentKey;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class OrderIdempotentService {

    private static final String IDEMPOTENT_PREFIX = "order:idempotent:";
    private static final long EXPIRE_SECONDS = 300;

    private final StringRedisTemplate redisTemplate;

    public OrderIdempotentService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void checkAndMark(String userId, String bizType, String timestamp) {
        String key = IDEMPOTENT_PREFIX + IdempotentKey.build(userId, bizType, Long.parseLong(timestamp));
        Boolean success = redisTemplate.opsForValue().setIfAbsent(key, "1", EXPIRE_SECONDS, TimeUnit.SECONDS);
        if (success == null || !success) {
            throw new BizException(CommonErrorCode.DUPLICATE_REQUEST, "重复提交，请勿重复操作");
        }
    }
}
