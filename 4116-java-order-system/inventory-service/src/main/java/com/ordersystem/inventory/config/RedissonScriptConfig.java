package com.ordersystem.inventory.config;

import lombok.RequiredArgsConstructor;
import org.redisson.api.RedissonClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import jakarta.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.stream.Collectors;

@Configuration
@RequiredArgsConstructor
@ConditionalOnProperty(name = "redisson.script.enabled", havingValue = "true", matchIfMissing = false)
public class RedissonScriptConfig {

    private final RedissonClient redissonClient;

    private static final String DEDUCT_SHA_KEY = "inventory:deduct:sha";
    private static final String RELEASE_SHA_KEY = "inventory:release:sha";

    @PostConstruct
    public void loadScripts() {
        String deductScript = loadScript("lua/inventory_deduct.lua");
        String deductSha = redissonClient.getScript().scriptLoad(deductScript);
        redissonClient.getBucket(DEDUCT_SHA_KEY).set(deductSha);

        String releaseScript = loadScript("lua/inventory_release.lua");
        String releaseSha = redissonClient.getScript().scriptLoad(releaseScript);
        redissonClient.getBucket(RELEASE_SHA_KEY).set(releaseSha);
    }

    private String loadScript(String path) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream()))) {
                return reader.lines().collect(Collectors.joining("\n"));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to load Lua script: " + path, e);
        }
    }
}
