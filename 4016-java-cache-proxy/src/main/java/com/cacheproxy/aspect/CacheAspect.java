package com.cacheproxy.aspect;

import com.cacheproxy.annotation.Cache;
import com.cacheproxy.annotation.CacheEvict;
import com.cacheproxy.config.CacheProxyProperties;
import com.cacheproxy.core.CacheKeyGenerator;
import com.cacheproxy.core.CacheValueWrapper;
import com.cacheproxy.manager.TwoLevelCacheManager;
import com.cacheproxy.pubsub.CacheEvictPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;

import java.lang.reflect.Method;

@Slf4j
@Aspect
@RequiredArgsConstructor
public class CacheAspect {

    private final TwoLevelCacheManager cacheManager;
    private final CacheEvictPublisher evictPublisher;
    private final CacheProxyProperties properties;

    @Around("@annotation(cache)")
    public Object aroundCache(ProceedingJoinPoint joinPoint, Cache cache) throws Throwable {
        if (!properties.isEnabled()) {
            return joinPoint.proceed();
        }

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();

        String cacheName = CacheKeyGenerator.generateCacheName(method, cache.prefix());
        String key = CacheKeyGenerator.generateKey(cache.prefix(), cache.key(), joinPoint);

        log.debug("Cache lookup for cache [{}], key [{}]", cacheName, key);

        boolean enablePenetration = cache.enablePenetrationProtect() && properties.getPenetration().isEnabled();
        CacheValueWrapper cached = cacheManager.get(cacheName, key, enablePenetration);

        if (cached != null) {
            if (cached.isNullValue()) {
                log.debug("Returning cached null value for key [{}] in cache [{}]", key, cacheName);
                return null;
            }
            return cached.getValue();
        }

        log.debug("Cache miss, proceeding with method execution for key [{}] in cache [{}]", key, cacheName);
        Object result = joinPoint.proceed();

        cacheManager.put(cacheName, key, result, cache.l1Ttl(), cache.l2Ttl(), cache.timeUnit());
        evictPublisher.publishEvict(cacheName, key, false);

        return result;
    }

    @Around("@annotation(cacheEvict)")
    public Object aroundCacheEvict(ProceedingJoinPoint joinPoint, CacheEvict cacheEvict) throws Throwable {
        if (!properties.isEnabled()) {
            return joinPoint.proceed();
        }

        Object result = joinPoint.proceed();

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();

        String cacheName = CacheKeyGenerator.generateCacheName(method, cacheEvict.prefix());

        if (cacheEvict.allEntries()) {
            log.debug("Evicting all entries from cache [{}]", cacheName);
            cacheManager.evictAll(cacheName);
            evictPublisher.publishEvict(cacheName, null, true);
        } else {
            String key = CacheKeyGenerator.generateKey(cacheEvict.prefix(), cacheEvict.key(), joinPoint);
            log.debug("Evicting key [{}] from cache [{}]", key, cacheName);
            cacheManager.evict(cacheName, key);
            evictPublisher.publishEvict(cacheName, key, false);
        }

        return result;
    }
}
