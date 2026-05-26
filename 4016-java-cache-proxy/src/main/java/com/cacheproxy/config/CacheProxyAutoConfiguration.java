package com.cacheproxy.config;

import com.cacheproxy.aspect.CacheAspect;
import com.cacheproxy.manager.TwoLevelCacheManager;
import com.cacheproxy.penetration.BloomFilterManager;
import com.cacheproxy.pubsub.CacheEvictMessageListener;
import com.cacheproxy.pubsub.CacheEvictPublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.common.hash.BloomFilter;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

@AutoConfiguration
@EnableConfigurationProperties(CacheProxyProperties.class)
@ConditionalOnProperty(prefix = "cache.proxy", name = "enabled", havingValue = "true", matchIfMissing = true)
public class CacheProxyAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public ObjectMapper cacheProxyObjectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        SimpleModule bloomFilterModule = new SimpleModule();
        bloomFilterModule.addSerializer(BloomFilter.class, new BloomFilterSerialization.BloomFilterSerializer());
        bloomFilterModule.addDeserializer(BloomFilter.class, new BloomFilterSerialization.BloomFilterDeserializer());
        objectMapper.registerModule(bloomFilterModule);
        return objectMapper;
    }

    @Bean
    @ConditionalOnMissingBean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    @Bean
    @ConditionalOnMissingBean
    public BloomFilterManager bloomFilterManager(CacheProxyProperties properties,
                                                 StringRedisTemplate redisTemplate,
                                                 ObjectMapper cacheProxyObjectMapper) {
        return new BloomFilterManager(properties, redisTemplate, cacheProxyObjectMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public TwoLevelCacheManager twoLevelCacheManager(CacheProxyProperties properties,
                                                     StringRedisTemplate redisTemplate,
                                                     ObjectMapper cacheProxyObjectMapper,
                                                     BloomFilterManager bloomFilterManager) {
        return new TwoLevelCacheManager(properties, redisTemplate, cacheProxyObjectMapper, bloomFilterManager);
    }

    @Bean
    @ConditionalOnMissingBean
    public CacheEvictPublisher cacheEvictPublisher(StringRedisTemplate redisTemplate,
                                                   CacheProxyProperties properties,
                                                   ObjectMapper cacheProxyObjectMapper) {
        return new CacheEvictPublisher(redisTemplate, properties, cacheProxyObjectMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public CacheEvictMessageListener cacheEvictMessageListener(TwoLevelCacheManager cacheManager,
                                                               CacheProxyProperties properties,
                                                               ObjectMapper cacheProxyObjectMapper) {
        return new CacheEvictMessageListener(cacheManager, properties, cacheProxyObjectMapper);
    }

    @Bean
    public MessageListenerAdapter messageListenerAdapter(CacheEvictMessageListener listener) {
        return new MessageListenerAdapter(listener, "onMessage");
    }

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(RedisConnectionFactory connectionFactory,
                                                                       MessageListenerAdapter listenerAdapter,
                                                                       CacheProxyProperties properties) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, new ChannelTopic(properties.getPubsub().getChannel()));
        return container;
    }

    @Bean
    @ConditionalOnMissingBean
    public CacheAspect cacheAspect(TwoLevelCacheManager cacheManager,
                                   CacheEvictPublisher evictPublisher,
                                   CacheProxyProperties properties) {
        return new CacheAspect(cacheManager, evictPublisher, properties);
    }
}
