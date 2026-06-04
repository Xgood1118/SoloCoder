package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("customer")
public class Customer {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String customerNo;

    private String companyName;

    private Integer customerType;

    private String industryCode;

    private String industryName;

    private Long provinceId;

    private Long cityId;

    private String address;

    private String website;

    private Integer employeeCount;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private BigDecimal annualRevenue;

    private String description;

    private Integer customerStatus;

    @TableLogic
    private Integer isDeleted;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date updatedTime;
}
