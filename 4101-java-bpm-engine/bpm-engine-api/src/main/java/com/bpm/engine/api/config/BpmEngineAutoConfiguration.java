package com.bpm.engine.api.config;

import com.bpm.engine.expression.sandbox.SandboxConfig;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@ComponentScan(basePackages = "com.bpm.engine")
@EnableJpaRepositories(basePackages = "com.bpm.engine")
@EntityScan(basePackages = "com.bpm.engine")
@EnableScheduling
@EnableConfigurationProperties({SandboxConfig.class})
public class BpmEngineAutoConfiguration {
}
