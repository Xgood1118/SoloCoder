package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("api_call_log")
public class ApiCallLog extends BaseEntity {

    private String clientId;
    private String userId;
    private String apiPath;
    private String httpMethod;
    private String requestIp;
    private String userAgent;
    private Long responseTime;
    private Integer responseCode;
    private String errorMessage;
}
