package com.oauth2.server.filter;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.oauth2.server.common.Result;
import com.oauth2.server.common.ResultCode;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.service.RateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String clientId = extractClientId(request);
        String apiPath = request.getRequestURI();

        if (StrUtil.isNotBlank(clientId) && shouldRateLimit(apiPath)) {
            if (!rateLimitService.isAllowed(clientId, apiPath)) {
                writeRateLimitError(response);
                return;
            }
        }

        long startTime = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long responseTime = System.currentTimeMillis() - startTime;
            String userId = extractUserId();
            rateLimitService.logApiCall(
                    clientId,
                    userId,
                    apiPath,
                    request.getMethod(),
                    getClientIp(request),
                    request.getHeader("User-Agent"),
                    responseTime,
                    response.getStatus(),
                    null
            );
        }
    }

    private String extractClientId(HttpServletRequest request) {
        String clientId = request.getParameter("client_id");
        if (StrUtil.isNotBlank(clientId)) {
            return clientId;
        }

        clientId = request.getHeader("X-Client-Id");
        if (StrUtil.isNotBlank(clientId)) {
            return clientId;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof LoginUserDTO user) {
            if (user.getUserId() == 0L) {
                return user.getUsername();
            }
        }

        return null;
    }

    private String extractUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof LoginUserDTO user) {
            return user.getUserId().toString();
        }
        return null;
    }

    private boolean shouldRateLimit(String apiPath) {
        return apiPath != null && !apiPath.contains("/actuator")
                && !apiPath.contains("/error")
                && !apiPath.contains("/favicon.ico");
    }

    private void writeRateLimitError(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        Result<Void> result = Result.error(ResultCode.QUOTA_EXCEEDED);
        response.getWriter().write(JSON.toJSONString(result));
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (StrUtil.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (StrUtil.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (StrUtil.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (StrUtil.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip.split(",")[0].trim();
    }
}
