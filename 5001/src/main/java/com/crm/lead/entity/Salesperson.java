package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("salesperson")
public class Salesperson {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String salesNo;

    private String name;

    private String phone;

    private String email;

    private String department;

    private String position;

    private Integer maxLoad;

    private Integer recoverThreshold;

    private Integer currentLeadCount;

    private Integer isActive;

    private Integer isEligible;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date updatedTime;
}
