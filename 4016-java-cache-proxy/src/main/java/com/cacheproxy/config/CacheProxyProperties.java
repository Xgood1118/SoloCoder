package com.cacheproxy.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.concurrent.TimeUnit;

@Data
@ConfigurationProperties(prefix = "cache.proxy")
public class CacheProxyProperties {

    private boolean enabled = true;

    private L1Properties l1 = new L1Properties();

    private L2Properties l2 = new L2Properties();

    private PubSubProperties pubsub = new PubSubProperties();

    private PenetrationProperties penetration = new PenetrationProperties();

    @Data
    public static class L1Properties {
        private long defaultTtl = 300;
        private long maximumSize = 10000;
        private TimeUnit timeUnit = TimeUnit.SECONDS;
    }

    @Data
    public static class L2Properties {
        private long defaultTtl = 3600;
        private TimeUnit timeUnit = TimeUnit.SECONDS;
        private String keyPrefix = "cache:proxy:";
    }

    @Data
    public static class PubSubProperties {
        private String channel = "cache:proxy:evict";
        private String instanceId = "default";
    }

    @Data
    public static class PenetrationProperties {
        private boolean enabled = true;
        private int missThreshold = 3;
        private long bloomExpectedInsertions = 100000;
        private double bloomFpp = 0.01;
        private long bloomTtl = 3600;
        private TimeUnit timeUnit = TimeUnit.SECONDS;
    }
}
