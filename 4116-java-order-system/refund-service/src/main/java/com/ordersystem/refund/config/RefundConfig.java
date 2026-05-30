package com.ordersystem.refund.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Data
@Component
@ConfigurationProperties(prefix = "refund")
public class RefundConfig {
    private BigDecimal auditThreshold = new BigDecimal("5000");
}
