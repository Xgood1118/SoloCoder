package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("third_party_user")
public class ThirdPartyUser extends BaseEntity {

    private Long userId;
    private String provider;
    private String openId;
    private String unionId;
    private String accessToken;
    private String refreshToken;
    private Long expiresIn;
    private String nickName;
    private String avatarUrl;
    private Integer status;
}
