package com.audit.mask;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MaskRuleConfig.class)
public class MaskAutoConfiguration {
}
