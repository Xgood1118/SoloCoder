package com.audit.mask;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashMap;
import java.util.Map;

@Data
@ConfigurationProperties(prefix = "audit.mask")
public class MaskRuleConfig {

    private Map<String, MaskRule> rules = new HashMap<>();
}
