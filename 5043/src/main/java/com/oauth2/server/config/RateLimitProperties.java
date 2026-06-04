package com.oauth2.server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "oauth2.rate-limit")
public class RateLimitProperties {

    private boolean enabled = true;
    private long defaultQuota = 1000;
    private int timeWindowSeconds = 60;
}
