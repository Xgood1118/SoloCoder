package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_data_permission")
public class SysDataPermission extends BaseEntity {

    private Long roleId;
    private String dataType;
    private String tableName;
    private String columnName;
    private String rowCondition;
    private String columnPermission;
    private Integer status;
    private String remark;
}
