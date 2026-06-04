package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_permission")
public class SysPermission extends BaseEntity {

    private String permissionCode;
    private String permissionName;
    private String resourceType;
    private String resourceUrl;
    private String resourceMethod;
    private Long parentId;
    private Integer sort;
    private Integer status;
    private String remark;
}
