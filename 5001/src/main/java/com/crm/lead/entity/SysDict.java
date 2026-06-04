package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("sys_dict")
public class SysDict {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String dictType;

    private String dictCode;

    private String dictName;

    private Integer sortOrder;

    private Integer isActive;

    private String remark;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;
}
