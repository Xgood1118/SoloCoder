package com.oauth2.server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "oauth2.token")
public class OAuth2TokenProperties {

    private int accessTokenExpireSeconds = 7200;
    private int refreshTokenExpireSeconds = 2592000;
    private String issuer = "http://localhost:8080/oauth2";
    private String signingKey = "oauth2-auth-server-signing-key-2024-secret";
}
