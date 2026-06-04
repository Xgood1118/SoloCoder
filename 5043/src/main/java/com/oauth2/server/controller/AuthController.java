package com.oauth2.server.controller;

import cn.hutool.core.util.StrUtil;
import com.oauth2.server.common.Result;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.dto.TokenRequestDTO;
import com.oauth2.server.dto.TokenResponseDTO;
import com.oauth2.server.service.OAuth2AuthorizationService;
import com.oauth2.server.service.RateLimitService;
import com.oauth2.server.service.SessionService;
import com.oauth2.server.service.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final OAuth2AuthorizationService authorizationService;
    private final SessionService sessionService;
    private final TokenService tokenService;
    private final RateLimitService rateLimitService;

    @PostMapping("/login")
    public Result<TokenResponseDTO> login(@RequestBody Map<String, String> loginData,
                                          @RequestParam(required = false) String clientId,
                                          @RequestParam(required = false) String clientSecret) {
        String username = loginData.get("username");
        String password = loginData.get("password");

        if (StrUtil.isBlank(clientId) || StrUtil.isBlank(clientSecret)) {
            clientId = "default_client";
            clientSecret = "default_secret";
        }

        TokenRequestDTO request = new TokenRequestDTO();
        request.setGrantType("password");
        request.setClientId(clientId);
        request.setClientSecret(clientSecret);
        request.setUsername(username);
        request.setPassword(password);

        return authorizationService.authorize(request);
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletRequest request,
                               @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof LoginUserDTO user) {
            authorizationService.logout(user.getUsername());
            sessionService.invalidateUserSessions(user.getUserId(), user.getUsername());
        }

        if (StrUtil.isNotBlank(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            tokenService.revokeToken(token);
        }

        sessionService.invalidateSession(request);
        SecurityContextHolder.clearContext();

        return Result.success();
    }

    @GetMapping("/me")
    public Result<Map<String, Object>> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof LoginUserDTO)) {
            return Result.error(401, "Not authenticated");
        }

        LoginUserDTO user = (LoginUserDTO) auth.getPrincipal();
        Map<String, Object> result = new HashMap<>();
        result.put("userId", user.getUserId());
        result.put("username", user.getUsername());
        result.put("nickname", user.getNickname());
        result.put("deptId", user.getDeptId());
        result.put("deptName", user.getDeptName());
        result.put("roles", user.getRoles());
        result.put("permissions", user.getPermissions());

        return Result.success(result);
    }

    @GetMapping("/sessions")
    public Result<Map<String, Object>> getActiveSessions() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof LoginUserDTO user)) {
            return Result.error(401, "Not authenticated");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("username", user.getUsername());
        result.put("activeSessions", sessionService.getActiveSessionsCount(user.getUsername()));

        return Result.success(result);
    }

    @PostMapping("/force-logout/{username}")
    public Result<Void> forceLogout(@PathVariable String username) {
        sessionService.forceLogout(username);
        authorizationService.logout(username);
        return Result.success();
    }

    @GetMapping("/quota")
    public Result<Map<String, Object>> getQuota(@RequestHeader("X-Client-Id") String clientId) {
        var quota = rateLimitService.getCurrentQuota(clientId);
        if (quota == null) {
            return Result.error("No quota found");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("clientId", quota.getClientId());
        result.put("dailyLimit", quota.getDailyLimit());
        result.put("dailyUsed", quota.getDailyUsed());
        result.put("hourlyLimit", quota.getHourlyLimit());
        result.put("hourlyUsed", quota.getHourlyUsed());
        result.put("minuteLimit", quota.getMinuteLimit());
        result.put("minuteUsed", quota.getMinuteUsed());
        result.put("quotaDate", quota.getQuotaDate());

        return Result.success(result);
    }

    @PostMapping("/refresh-token")
    public Result<TokenResponseDTO> refreshToken(@RequestParam String refreshToken,
                                                 @RequestParam String clientId,
                                                 @RequestParam String clientSecret) {
        TokenRequestDTO request = new TokenRequestDTO();
        request.setGrantType("refresh_token");
        request.setClientId(clientId);
        request.setClientSecret(clientSecret);
        request.setRefreshToken(refreshToken);

        return authorizationService.authorize(request);
    }
}
