package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("api_quota")
public class ApiQuota extends BaseEntity {

    private String clientId;
    private Long dailyLimit;
    private Long hourlyLimit;
    private Long minuteLimit;
    private Long dailyUsed;
    private Long hourlyUsed;
    private Long minuteUsed;
    private String quotaDate;
    private Integer status;
}
