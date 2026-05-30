package com.audit.alarm.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class AlarmConfig {

    public static final String ALARM_EXCHANGE = "audit.alarm.exchange";
    public static final String ALARM_QUEUE = "audit.alarm.queue";
    public static final String ALARM_ROUTING_KEY = "audit.alarm.event";
    public static final String ALARM_RECOVERY_ROUTING_KEY = "audit.alarm.recovery";

    @Bean
    public DirectExchange alarmExchange() {
        return new DirectExchange(ALARM_EXCHANGE, true, false);
    }

    @Bean
    public Queue alarmQueue() {
        return new Queue(ALARM_QUEUE, true, false, false);
    }

    @Bean
    public Binding alarmBinding(Queue alarmQueue, DirectExchange alarmExchange) {
        return BindingBuilder.bind(alarmQueue).to(alarmExchange).with(ALARM_ROUTING_KEY);
    }

    @Bean
    public MessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RedisTemplate<String, Object> alarmRedisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}
