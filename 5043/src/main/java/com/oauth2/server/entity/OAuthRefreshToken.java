package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("oauth_refresh_token")
public class OAuthRefreshToken extends BaseEntity {

    private String tokenId;
    private byte[] token;
    private byte[] authentication;
    private LocalDateTime expiresAt;
}
