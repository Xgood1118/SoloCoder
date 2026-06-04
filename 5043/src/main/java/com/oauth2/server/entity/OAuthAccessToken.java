package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("oauth_access_token")
public class OAuthAccessToken extends BaseEntity {

    private String tokenId;
    private byte[] token;
    private String authenticationId;
    private String userName;
    private String clientId;
    private byte[] authentication;
    private String refreshToken;
    private LocalDateTime expiresAt;
}
