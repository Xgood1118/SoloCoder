package com.cacheproxy.pubsub;

import com.cacheproxy.config.CacheProxyProperties;
import com.cacheproxy.core.CacheEvictEvent;
import com.cacheproxy.manager.TwoLevelCacheManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;

@Slf4j
@RequiredArgsConstructor
public class CacheEvictMessageListener implements MessageListener {

    private final TwoLevelCacheManager cacheManager;
    private final CacheProxyProperties properties;
    private final ObjectMapper objectMapper;

    @Override
    @SneakyThrows
    public void onMessage(Message message, byte[] pattern) {
        String body = new String(message.getBody());
        CacheEvictEvent event = objectMapper.readValue(body, CacheEvictEvent.class);

        String localInstanceId = properties.getPubsub().getInstanceId();
        if (localInstanceId.equals(event.getSourceInstanceId())) {
            log.debug("Ignoring evict event from self instance: {}", localInstanceId);
            return;
        }

        log.debug("Received cache evict event: {}", event);

        if (event.isAllEntries()) {
            cacheManager.evictAllLocalOnly(event.getCacheName());
        } else {
            cacheManager.evictLocalOnly(event.getCacheName(), event.getKey());
        }
    }
}
