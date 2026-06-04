package com.oauth2.server;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;

@SpringBootApplication
@MapperScan("com.oauth2.server.mapper")
@EnableCaching
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)
public class OAuth2AuthServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(OAuth2AuthServerApplication.class, args);
        System.out.println("OAuth2 Unified Authentication Server started successfully!");
    }
}
