package com.oauth2.server.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.oauth2.server.common.Result;
import com.oauth2.server.common.ResultCode;
import com.oauth2.server.dto.LoginUserDTO;
import com.oauth2.server.dto.TokenRequestDTO;
import com.oauth2.server.dto.TokenResponseDTO;
import com.oauth2.server.entity.OAuthClient;
import com.oauth2.server.mapper.OAuthClientMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuth2AuthorizationService {

    private static final String GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";
    private static final String GRANT_TYPE_IMPLICIT = "implicit";
    private static final String GRANT_TYPE_PASSWORD = "password";
    private static final String GRANT_TYPE_CLIENT_CREDENTIALS = "client_credentials";
    private static final String GRANT_TYPE_REFRESH_TOKEN = "refresh_token";

    private final OAuthClientMapper oAuthClientMapper;
    private final TokenService tokenService;
    private final UserDetailsServiceImpl userDetailsService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    public Result<TokenResponseDTO> authorize(TokenRequestDTO request) {
        String grantType = request.getGrantType();
        if (StrUtil.isBlank(grantType)) {
            return Result.error(ResultCode.INVALID_GRANT);
        }

        Optional<OAuthClient> clientOpt = oAuthClientMapper.selectByClientId(request.getClientId());
        if (clientOpt.isEmpty()) {
            return Result.error(ResultCode.INVALID_CLIENT);
        }

        OAuthClient client = clientOpt.get();
        if (!passwordEncoder.matches(request.getClientSecret(), client.getClientSecret())) {
            return Result.error(ResultCode.INVALID_CLIENT);
        }

        if (client.getStatus() != 1) {
            return Result.error(ResultCode.INVALID_CLIENT);
        }

        if (!client.getAuthorizedGrantTypes().contains(grantType)) {
            return Result.error(ResultCode.UNSUPPORTED_GRANT_TYPE);
        }

        return switch (grantType) {
            case GRANT_TYPE_AUTHORIZATION_CODE -> handleAuthorizationCode(request, client);
            case GRANT_TYPE_IMPLICIT -> handleImplicit(request, client);
            case GRANT_TYPE_PASSWORD -> handlePassword(request, client);
            case GRANT_TYPE_CLIENT_CREDENTIALS -> handleClientCredentials(request, client);
            case GRANT_TYPE_REFRESH_TOKEN -> handleRefreshToken(request, client);
            default -> Result.error(ResultCode.UNSUPPORTED_GRANT_TYPE);
        };
    }

    private Result<TokenResponseDTO> handleAuthorizationCode(TokenRequestDTO request, OAuthClient client) {
        if (StrUtil.isBlank(request.getCode())) {
            return Result.error(ResultCode.INVALID_AUTHORIZATION_CODE);
        }

        Optional<Map<String, Object>> codeInfoOpt = tokenService.getAuthorizationCodeInfo(request.getCode());
        if (codeInfoOpt.isEmpty()) {
            return Result.error(ResultCode.INVALID_AUTHORIZATION_CODE);
        }

        Map<String, Object> codeInfo = codeInfoOpt.get();
        String storedClientId = (String) codeInfo.get("clientId");
        String storedRedirectUri = (String) codeInfo.get("redirectUri");

        if (!client.getClientId().equals(storedClientId)) {
            return Result.error(ResultCode.INVALID_AUTHORIZATION_CODE);
        }

        if (request.getRedirectUri() != null && !request.getRedirectUri().equals(storedRedirectUri)) {
            return Result.error(ResultCode.INVALID_AUTHORIZATION_CODE);
        }

        LoginUserDTO loginUser = (LoginUserDTO) codeInfo.get("loginUser");
        TokenResponseDTO response = tokenService.createTokenResponse(loginUser, client.getClientId());
        return Result.success(response);
    }

    private Result<TokenResponseDTO> handleImplicit(TokenRequestDTO request, OAuthClient client) {
        return Result.error(ResultCode.UNSUPPORTED_GRANT_TYPE);
    }

    private Result<TokenResponseDTO> handlePassword(TokenRequestDTO request, OAuthClient client) {
        if (StrUtil.isBlank(request.getUsername()) || StrUtil.isBlank(request.getPassword())) {
            return Result.error(ResultCode.INVALID_USERNAME_PASSWORD);
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );

            if (authentication.isAuthenticated()) {
                LoginUserDTO loginUser = (LoginUserDTO) authentication.getPrincipal();
                TokenResponseDTO response = tokenService.createTokenResponse(loginUser, client.getClientId());
                return Result.success(response);
            }
        } catch (Exception e) {
            log.error("Password grant authentication failed: {}", e.getMessage());
        }

        return Result.error(ResultCode.INVALID_USERNAME_PASSWORD);
    }

    private Result<TokenResponseDTO> handleClientCredentials(TokenRequestDTO request, OAuthClient client) {
        LoginUserDTO clientUser = new LoginUserDTO();
        clientUser.setUserId(0L);
        clientUser.setUsername(client.getClientId());
        clientUser.setNickname(client.getClientName());
        clientUser.setEnabled(true);
        clientUser.setAccountNonExpired(true);
        clientUser.setAccountNonLocked(true);
        clientUser.setCredentialsNonExpired(true);

        TokenResponseDTO response = tokenService.createTokenResponse(clientUser, client.getClientId());
        return Result.success(response);
    }

    private Result<TokenResponseDTO> handleRefreshToken(TokenRequestDTO request, OAuthClient client) {
        if (StrUtil.isBlank(request.getRefreshToken())) {
            return Result.error(ResultCode.INVALID_TOKEN);
        }

        Optional<TokenResponseDTO> refreshed = tokenService.refreshAccessToken(request.getRefreshToken(), client.getClientId());
        if (refreshed.isPresent()) {
            return Result.success(refreshed.get());
        }

        return Result.error(ResultCode.INVALID_TOKEN);
    }

    public String generateAuthorizationCode(LoginUserDTO loginUser, String clientId, String redirectUri) {
        String code = IdUtil.simpleUUID();
        tokenService.storeAuthorizationCode(code, loginUser, clientId, redirectUri);
        return code;
    }

    public Result<Void> revokeToken(String token) {
        if (StrUtil.isNotBlank(token) && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        tokenService.revokeToken(token);
        return Result.success();
    }

    public Result<Void> logout(String username) {
        tokenService.revokeAllTokensForUser(username);
        return Result.success();
    }

    public Optional<OAuthClient> getClient(String clientId) {
        return oAuthClientMapper.selectByClientId(clientId);
    }
}
