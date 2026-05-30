package com.ordersystem.payment.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Data
@Configuration
@ConfigurationProperties(prefix = "payment")
public class PaymentConfig {

    private Map<String, ChannelConfig> channels;

    @Data
    public static class ChannelConfig {
        private String appId;
        private String secret;
        private String gatewayUrl;
        private String callbackUrl;
    }
}
