package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("oauth_authorization_code")
public class OAuthAuthorizationCode extends BaseEntity {

    private String code;
    private byte[] authentication;
    private String clientId;
    private String userName;
    private LocalDateTime expiresAt;
}
