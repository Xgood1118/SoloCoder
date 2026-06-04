package com.oauth2.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenResponseDTO implements Serializable {

    private String accessToken;
    private String tokenType;
    private Long expiresIn;
    private String refreshToken;
    private String scope;
    private Long createdAt;
}
