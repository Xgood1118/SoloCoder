package com.audit.report;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Data
@Configuration
@EnableScheduling
@ConfigurationProperties(prefix = "audit.report")
public class ReportConfig {

    private String storagePath = "./reports";
    private String archivePath = "./archive";
    private String keystorePath = "./keystore.jks";
    private String keystorePassword = "changeit";
    private String encryptionKey = "0123456789abcdef0123456789abcdef";
    private int retentionDays = 365;
}
