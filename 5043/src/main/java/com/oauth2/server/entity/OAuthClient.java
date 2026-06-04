package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("oauth_client")
public class OAuthClient extends BaseEntity {

    private String clientId;
    private String clientSecret;
    private String clientName;
    private String clientType;
    private String authorizedGrantTypes;
    private String webServerRedirectUri;
    private String scope;
    private Integer accessTokenValidity;
    private Integer refreshTokenValidity;
    private String additionalInformation;
    private String autoapprove;
    private Integer status;
    private Long dailyQuota;
    private Long hourlyQuota;
    private Long minuteQuota;
}
