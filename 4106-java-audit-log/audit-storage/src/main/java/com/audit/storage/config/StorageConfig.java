package com.audit.storage.config;

import com.audit.storage.StorageHealthChecker;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

@Slf4j
@Configuration
public class StorageConfig {

    private final StorageHealthChecker healthChecker;

    public StorageConfig(StorageHealthChecker healthChecker) {
        this.healthChecker = healthChecker;
    }

    @Bean(name = "clickHouseDataSource")
    @ConfigurationProperties(prefix = "audit.storage.clickhouse.jdbc")
    public DataSource clickHouseDataSource() {
        return DataSourceBuilder.create().type(HikariDataSource.class).build();
    }

    @Bean(name = "clickHouseJdbcTemplate")
    public JdbcTemplate clickHouseJdbcTemplate(@Qualifier("clickHouseDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @jakarta.annotation.PostConstruct
    public void logStartupHealth() {
        var healthMap = healthChecker.checkAll();
        healthMap.forEach((type, healthy) ->
                log.info("Storage backend {} - healthy: {}", type, healthy));
        if (!healthChecker.isAllHealthy()) {
            log.warn("Not all storage backends are healthy. Check configuration.");
        }
    }
}
