package com.oauth2.server.service;

import com.oauth2.server.config.RateLimitProperties;
import com.oauth2.server.entity.ApiCallLog;
import com.oauth2.server.entity.ApiQuota;
import com.oauth2.server.entity.OAuthClient;
import com.oauth2.server.mapper.ApiCallLogMapper;
import com.oauth2.server.mapper.ApiQuotaMapper;
import com.oauth2.server.mapper.OAuthClientMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RRateLimiter;
import org.redisson.api.RateIntervalUnit;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private static final String RATE_LIMIT_PREFIX = "oauth2:rate:";
    private static final String API_CALL_PREFIX = "oauth2:call:";

    private final RateLimitProperties rateLimitProperties;
    private final RedissonClient redissonClient;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ApiQuotaMapper apiQuotaMapper;
    private final ApiCallLogMapper apiCallLogMapper;
    private final OAuthClientMapper oAuthClientMapper;

    public boolean isAllowed(String clientId, String apiPath) {
        if (!rateLimitProperties.isEnabled()) {
            return true;
        }

        boolean rateLimitPassed = checkRateLimit(clientId, apiPath);
        if (!rateLimitPassed) {
            return false;
        }

        return checkQuota(clientId);
    }

    private boolean checkRateLimit(String clientId, String apiPath) {
        String key = RATE_LIMIT_PREFIX + clientId + ":" + apiPath;
        RRateLimiter rateLimiter = redissonClient.getRateLimiter(key);

        if (!rateLimiter.isExists()) {
            rateLimiter.trySetRate(RateType.OVERALL, rateLimitProperties.getDefaultQuota(),
                    rateLimitProperties.getTimeWindowSeconds(), RateIntervalUnit.SECONDS);
        }

        return rateLimiter.tryAcquire(1);
    }

    private boolean checkQuota(String clientId) {
        String today = LocalDate.now().toString();
        String key = API_CALL_PREFIX + clientId + ":" + today;

        Optional<ApiQuota> quotaOpt = apiQuotaMapper.selectByClientIdAndDate(clientId, today);
        ApiQuota quota;

        if (quotaOpt.isPresent()) {
            quota = quotaOpt.get();
        } else {
            quota = createQuota(clientId, today);
        }

        if (quota.getMinuteUsed() >= quota.getMinuteLimit()) {
            return false;
        }
        if (quota.getHourlyUsed() >= quota.getHourlyLimit()) {
            return false;
        }
        if (quota.getDailyUsed() >= quota.getDailyLimit()) {
            return false;
        }

        apiQuotaMapper.incrementUsed(clientId, today);
        incrementRedisCount(key);

        return true;
    }

    private ApiQuota createQuota(String clientId, String today) {
        Optional<OAuthClient> clientOpt = oAuthClientMapper.selectByClientId(clientId);
        long dailyLimit = rateLimitProperties.getDefaultQuota() * 60 * 24;
        long hourlyLimit = rateLimitProperties.getDefaultQuota() * 60;
        long minuteLimit = rateLimitProperties.getDefaultQuota();

        if (clientOpt.isPresent()) {
            OAuthClient client = clientOpt.get();
            if (client.getDailyQuota() != null && client.getDailyQuota() > 0) {
                dailyLimit = client.getDailyQuota();
            }
            if (client.getHourlyQuota() != null && client.getHourlyQuota() > 0) {
                hourlyLimit = client.getHourlyQuota();
            }
            if (client.getMinuteQuota() != null && client.getMinuteQuota() > 0) {
                minuteLimit = client.getMinuteQuota();
            }
        }

        ApiQuota quota = new ApiQuota();
        quota.setClientId(clientId);
        quota.setDailyLimit(dailyLimit);
        quota.setHourlyLimit(hourlyLimit);
        quota.setMinuteLimit(minuteLimit);
        quota.setDailyUsed(0L);
        quota.setHourlyUsed(0L);
        quota.setMinuteUsed(0L);
        quota.setQuotaDate(today);
        quota.setStatus(1);
        apiQuotaMapper.insert(quota);

        return quota;
    }

    private void incrementRedisCount(String key) {
        redisTemplate.opsForValue().increment(key, 1);
        redisTemplate.expire(key, 2, TimeUnit.DAYS);
    }

    public void logApiCall(String clientId, String userId, String apiPath, String httpMethod,
                           String requestIp, String userAgent, long responseTime,
                           int responseCode, String errorMessage) {
        ApiCallLog log = new ApiCallLog();
        log.setClientId(clientId);
        log.setUserId(userId);
        log.setApiPath(apiPath);
        log.setHttpMethod(httpMethod);
        log.setRequestIp(requestIp);
        log.setUserAgent(userAgent);
        log.setResponseTime(responseTime);
        log.setResponseCode(responseCode);
        log.setErrorMessage(errorMessage);
        apiCallLogMapper.insert(log);
    }

    public ApiQuota getCurrentQuota(String clientId) {
        String today = LocalDate.now().toString();
        return apiQuotaMapper.selectByClientIdAndDate(clientId, today).orElse(null);
    }

    public void resetMinuteQuota(String clientId) {
        String today = LocalDate.now().toString();
        apiQuotaMapper.resetMinuteUsed(clientId, today);
    }

    public void resetHourlyQuota(String clientId) {
        String today = LocalDate.now().toString();
        apiQuotaMapper.resetHourlyUsed(clientId, today);
    }
}
