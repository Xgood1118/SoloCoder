package com.oauth2.server.controller;

import cn.hutool.core.util.StrUtil;
import com.oauth2.server.common.Result;
import com.oauth2.server.common.ResultCode;
import com.oauth2.server.config.ApplicationContextProvider;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.dto.TokenRequestDTO;
import com.oauth2.server.dto.TokenResponseDTO;
import com.oauth2.server.entity.OAuthClient;
import com.oauth2.server.service.OAuth2AuthorizationService;
import com.oauth2.server.service.SessionService;
import com.oauth2.server.service.TokenService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
public class OAuth2Controller {

    private final OAuth2AuthorizationService authorizationService;
    private final SessionService sessionService;

    @PostMapping("/token")
    public Result<TokenResponseDTO> token(@RequestBody TokenRequestDTO request) {
        return authorizationService.authorize(request);
    }

    @GetMapping("/authorize")
    public void authorize(@RequestParam String responseType,
                          @RequestParam String clientId,
                          @RequestParam String redirectUri,
                          @RequestParam(required = false) String scope,
                          @RequestParam(required = false) String state,
                          HttpServletRequest request,
                          HttpServletResponse response) throws IOException {

        Optional<OAuthClient> clientOpt = authorizationService.getClient(clientId);
        if (clientOpt.isEmpty()) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Invalid client");
            return;
        }

        OAuthClient client = clientOpt.get();
        if (!client.getWebServerRedirectUri().contains(redirectUri)) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Invalid redirect URI");
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() instanceof String) {
            sessionService.setSessionAttribute(request, "oauth2_request",
                    Map.of("responseType", responseType, "clientId", clientId,
                            "redirectUri", redirectUri, "scope", scope, "state", state));
            response.sendRedirect("/oauth2/login");
            return;
        }

        LoginUserDTO loginUser = (LoginUserDTO) auth.getPrincipal();

        if ("code".equals(responseType)) {
            String code = authorizationService.generateAuthorizationCode(loginUser, clientId, redirectUri);
            String redirectUrl = redirectUri + (redirectUri.contains("?") ? "&" : "?")
                    + "code=" + code + (StrUtil.isNotBlank(state) ? "&state=" + state : "");
            response.sendRedirect(redirectUrl);
        } else if ("token".equals(responseType)) {
            TokenResponseDTO tokenResponse = authorizationService.authorize(
                    buildTokenRequest("implicit", clientId, client.getClientSecret(), loginUser.getUsername(),
                            null, null, null)
            ).getData();

            String redirectUrl = redirectUri + "#access_token=" + tokenResponse.getAccessToken()
                    + "&token_type=bearer&expires_in=" + tokenResponse.getExpiresIn()
                    + "&scope=" + tokenResponse.getScope()
                    + (StrUtil.isNotBlank(state) ? "&state=" + state : "");
            response.sendRedirect(redirectUrl);
        } else {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Unsupported response type");
        }
    }

    @PostMapping("/check_token")
    public Result<Map<String, Object>> checkToken(@RequestParam String token) {
        if (StrUtil.isBlank(token)) {
            return Result.error(ResultCode.INVALID_TOKEN);
        }

        Optional<TokenService> tokenServiceOpt =
                Optional.ofNullable(ApplicationContextProvider.getApplicationContext()
                        .getBean(TokenService.class));

        if (tokenServiceOpt.isEmpty()) {
            return Result.error(ResultCode.INVALID_TOKEN);
        }

        TokenService tokenService = tokenServiceOpt.get();
        if (!tokenService.validateToken(token)) {
            return Result.error(ResultCode.INVALID_TOKEN);
        }

        Claims claims = tokenService.parseToken(token);
        if (claims == null) {
            return Result.error(ResultCode.INVALID_TOKEN);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("active", true);
        result.put("username", claims.get("username"));
        result.put("client_id", claims.get("clientId"));
        result.put("scope", claims.get("permissions"));
        result.put("exp", claims.getExpiration().getTime() / 1000);
        result.put("iat", claims.getIssuedAt().getTime() / 1000);

        return Result.success(result);
    }

    @PostMapping("/introspect")
    public Result<Map<String, Object>> introspect(@RequestParam String token) {
        return checkToken(token);
    }

    @PostMapping("/revoke")
    public Result<Void> revokeToken(@RequestHeader("Authorization") String authHeader) {
        if (StrUtil.isBlank(authHeader)) {
            return Result.error(ResultCode.INVALID_TOKEN);
        }
        return authorizationService.revokeToken(authHeader);
    }

    private TokenRequestDTO buildTokenRequest(String grantType, String clientId, String clientSecret,
                                              String username, String password, String code, String refreshToken) {
        TokenRequestDTO request = new TokenRequestDTO();
        request.setGrantType(grantType);
        request.setClientId(clientId);
        request.setClientSecret(clientSecret);
        request.setUsername(username);
        request.setPassword(password);
        request.setCode(code);
        request.setRefreshToken(refreshToken);
        return request;
    }
}
