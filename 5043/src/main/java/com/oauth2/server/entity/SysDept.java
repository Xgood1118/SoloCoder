package com.oauth2.server.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.oauth2.server.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_dept")
public class SysDept extends BaseEntity {

    private String deptCode;
    private String deptName;
    private Long parentId;
    private String ancestors;
    private Integer deptSort;
    private String leader;
    private String phone;
    private String email;
    private Integer status;
}
