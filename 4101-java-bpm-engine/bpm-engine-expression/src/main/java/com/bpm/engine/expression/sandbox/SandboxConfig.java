package com.bpm.engine.expression.sandbox;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "bpm.expression.sandbox")
public class SandboxConfig {

    private long maxMemoryBytes = 50 * 1024 * 1024;
    private long maxCpuTimeMs = 5000;
    private int maxOutputLength = 10000;
    private List<String> allowedClasses = new ArrayList<>();
    private List<String> blockedClasses = new ArrayList<>(List.of(
            "java.lang.Runtime",
            "java.lang.ProcessBuilder",
            "java.lang.Thread",
            "java.lang.ClassLoader",
            "java.lang.System"
    ));
    private boolean enabled = true;
}
