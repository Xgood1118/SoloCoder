package com.oauth2.server.service;

import com.oauth2.server.config.ApplicationContextProvider;
import com.oauth2.server.config.OAuth2TokenProperties;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.dto.TokenResponseDTO;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private static final String ACCESS_TOKEN_PREFIX = "oauth2:access:";
    private static final String REFRESH_TOKEN_PREFIX = "oauth2:refresh:";
    private static final String AUTHENTICATION_PREFIX = "oauth2:auth:";

    private final OAuth2TokenProperties tokenProperties;
    private final RedisTemplate<String, Object> redisTemplate;

    private SecretKey getSigningKey() {
        byte[] keyBytes = tokenProperties.getSigningKey().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(LoginUserDTO loginUser, String clientId) {
        Map<String, Object> claims = buildClaims(loginUser, clientId);
        Date now = new Date();
        Date expiration = new Date(now.getTime() + tokenProperties.getAccessTokenExpireSeconds() * 1000L);

        String token = Jwts.builder()
                .setClaims(claims)
                .setIssuer(tokenProperties.getIssuer())
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();

        String tokenKey = ACCESS_TOKEN_PREFIX + token;
        redisTemplate.opsForValue().set(tokenKey, loginUser, tokenProperties.getAccessTokenExpireSeconds(), TimeUnit.SECONDS);

        return token;
    }

    public String generateRefreshToken(LoginUserDTO loginUser, String clientId) {
        String refreshToken = UUID.randomUUID().toString().replace("-", "");
        String tokenKey = REFRESH_TOKEN_PREFIX + refreshToken;

        Map<String, Object> tokenInfo = new HashMap<>();
        tokenInfo.put("userId", loginUser.getUserId());
        tokenInfo.put("username", loginUser.getUsername());
        tokenInfo.put("clientId", clientId);
        tokenInfo.put("createdAt", System.currentTimeMillis());

        redisTemplate.opsForValue().set(tokenKey, tokenInfo, tokenProperties.getRefreshTokenExpireSeconds(), TimeUnit.SECONDS);

        return refreshToken;
    }

    public TokenResponseDTO createTokenResponse(LoginUserDTO loginUser, String clientId) {
        String accessToken = generateAccessToken(loginUser, clientId);
        String refreshToken = generateRefreshToken(loginUser, clientId);

        return TokenResponseDTO.builder()
                .accessToken(accessToken)
                .tokenType("bearer")
                .expiresIn((long) tokenProperties.getAccessTokenExpireSeconds())
                .refreshToken(refreshToken)
                .scope(String.join(" ", loginUser.getPermissions()))
                .createdAt(System.currentTimeMillis())
                .build();
    }

    public Claims parseToken(String token) {
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (Exception e) {
            log.error("Token parsing failed: {}", e.getMessage());
            return null;
        }
    }

    public boolean validateToken(String token) {
        try {
            Claims claims = parseToken(token);
            if (claims == null) {
                return false;
            }
            Date expiration = claims.getExpiration();
            if (expiration.before(new Date())) {
                return false;
            }
            String tokenKey = ACCESS_TOKEN_PREFIX + token;
            return Boolean.TRUE.equals(redisTemplate.hasKey(tokenKey));
        } catch (Exception e) {
            log.error("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    public LoginUserDTO getLoginUserByToken(String token) {
        String tokenKey = ACCESS_TOKEN_PREFIX + token;
        Object obj = redisTemplate.opsForValue().get(tokenKey);
        if (obj instanceof LoginUserDTO) {
            return (LoginUserDTO) obj;
        }
        return null;
    }

    public Optional<TokenResponseDTO> refreshAccessToken(String refreshToken, String clientId) {
        String tokenKey = REFRESH_TOKEN_PREFIX + refreshToken;
        Object obj = redisTemplate.opsForValue().get(tokenKey);

        if (obj == null) {
            return Optional.empty();
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> tokenInfo = (Map<String, Object>) obj;
        String storedClientId = (String) tokenInfo.get("clientId");

        if (!clientId.equals(storedClientId)) {
            return Optional.empty();
        }

        Long userId = ((Number) tokenInfo.get("userId")).longValue();
        String username = (String) tokenInfo.get("username");

        redisTemplate.delete(tokenKey);

        String oldAccessPattern = ACCESS_TOKEN_PREFIX + "*";
        Set<String> oldKeys = redisTemplate.keys(oldAccessPattern);
        if (oldKeys != null && !oldKeys.isEmpty()) {
            for (String key : oldKeys) {
                Object userObj = redisTemplate.opsForValue().get(key);
                if (userObj instanceof LoginUserDTO userDTO && username.equals(userDTO.getUsername())) {
                    redisTemplate.delete(key);
                }
            }
        }

        UserDetailsServiceImpl userDetailsService = ApplicationContextProvider.getBean(UserDetailsServiceImpl.class);
        LoginUserDTO loginUser = userDetailsService.loadUserById(userId);
        TokenResponseDTO response = createTokenResponse(loginUser, clientId);

        return Optional.of(response);
    }

    public void revokeToken(String token) {
        String accessKey = ACCESS_TOKEN_PREFIX + token;
        redisTemplate.delete(accessKey);
    }

    public void revokeAllTokensForUser(String username) {
        String pattern = ACCESS_TOKEN_PREFIX + "*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null) {
            for (String key : keys) {
                Object obj = redisTemplate.opsForValue().get(key);
                if (obj instanceof LoginUserDTO) {
                    LoginUserDTO user = (LoginUserDTO) obj;
                    if (username.equals(user.getUsername())) {
                        redisTemplate.delete(key);
                    }
                }
            }
        }

        String refreshPattern = REFRESH_TOKEN_PREFIX + "*";
        Set<String> refreshKeys = redisTemplate.keys(refreshPattern);
        if (refreshKeys != null) {
            for (String key : refreshKeys) {
                Object obj = redisTemplate.opsForValue().get(key);
                if (obj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> info = (Map<String, Object>) obj;
                    if (username.equals(info.get("username"))) {
                        redisTemplate.delete(key);
                    }
                }
            }
        }
    }

    private Map<String, Object> buildClaims(LoginUserDTO loginUser, String clientId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", loginUser.getUserId());
        claims.put("username", loginUser.getUsername());
        claims.put("nickname", loginUser.getNickname());
        claims.put("deptId", loginUser.getDeptId());
        claims.put("deptName", loginUser.getDeptName());
        claims.put("clientId", clientId);
        claims.put("roles", loginUser.getRoles());
        claims.put("permissions", loginUser.getPermissions());
        return claims;
    }

    public long getExpiresIn(String token) {
        Claims claims = parseToken(token);
        if (claims == null) {
            return 0;
        }
        Date expiration = claims.getExpiration();
        long now = System.currentTimeMillis();
        long exp = expiration.getTime();
        return Math.max(0, (exp - now) / 1000);
    }

    public void storeAuthorizationCode(String code, LoginUserDTO loginUser, String clientId, String redirectUri) {
        String codeKey = "oauth2:code:" + code;
        Map<String, Object> codeInfo = new HashMap<>();
        codeInfo.put("loginUser", loginUser);
        codeInfo.put("clientId", clientId);
        codeInfo.put("redirectUri", redirectUri);
        codeInfo.put("createdAt", System.currentTimeMillis());
        redisTemplate.opsForValue().set(codeKey, codeInfo, 5, TimeUnit.MINUTES);
    }

    public Optional<Map<String, Object>> getAuthorizationCodeInfo(String code) {
        String codeKey = "oauth2:code:" + code;
        Object obj = redisTemplate.opsForValue().get(codeKey);
        if (obj == null) {
            return Optional.empty();
        }
        redisTemplate.delete(codeKey);
        @SuppressWarnings("unchecked")
        Map<String, Object> codeInfo = (Map<String, Object>) obj;
        return Optional.of(codeInfo);
    }
}
