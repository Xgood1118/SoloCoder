package com.oauth2.server.filter;

import cn.hutool.core.util.StrUtil;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.service.DataPermissionService;
import com.oauth2.server.service.TokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class TokenAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final DataPermissionService dataPermissionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractToken(request);

        try {
            if (StrUtil.isNotBlank(token) && tokenService.validateToken(token)) {
                LoginUserDTO loginUser = tokenService.getLoginUserByToken(token);
                if (loginUser != null) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    dataPermissionService.setCurrentUser(loginUser);
                }
            }

            filterChain.doFilter(request, response);
        } finally {
            dataPermissionService.clearCurrentUser();
        }
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StrUtil.isNotBlank(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        String paramToken = request.getParameter("access_token");
        if (StrUtil.isNotBlank(paramToken)) {
            return paramToken;
        }

        return null;
    }
}
