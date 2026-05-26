package com.cacheproxy.pubsub;

import com.cacheproxy.config.CacheProxyProperties;
import com.cacheproxy.core.CacheEvictEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;

@Slf4j
@RequiredArgsConstructor
public class CacheEvictPublisher {

    private final StringRedisTemplate redisTemplate;
    private final CacheProxyProperties properties;
    private final ObjectMapper objectMapper;

    @SneakyThrows
    public void publishEvict(String cacheName, String key, boolean allEntries) {
        String instanceId = properties.getPubsub().getInstanceId();
        CacheEvictEvent event = CacheEvictEvent.of(cacheName, key, allEntries, instanceId);
        String message = objectMapper.writeValueAsString(event);
        String channel = properties.getPubsub().getChannel();

        redisTemplate.convertAndSend(channel, message);
        log.debug("Published cache evict event to channel [{}]: {}", channel, event);
    }
}
