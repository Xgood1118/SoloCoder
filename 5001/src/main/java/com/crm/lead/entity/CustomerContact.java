package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("customer_contact")
public class CustomerContact {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long customerId;

    private String contactName;

    private Integer contactRole;

    private String position;

    private String phone;

    private String email;

    private String wechat;

    private Integer isDecisionMaker;

    private String remark;

    @TableLogic
    private Integer isDeleted;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date updatedTime;
}
