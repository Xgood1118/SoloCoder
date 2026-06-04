package com.oauth2.server.dto;

import lombok.Data;

import java.io.Serializable;

@Data
public class TokenRequestDTO implements Serializable {

    private String grantType;
    private String clientId;
    private String clientSecret;
    private String code;
    private String redirectUri;
    private String username;
    private String password;
    private String refreshToken;
    private String scope;
}
