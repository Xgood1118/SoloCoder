package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("sales_region_industry")
public class SalesRegionIndustry {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long salespersonId;

    private Long regionId;

    private String industryCode;

    private String industryName;

    private Integer priority;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;
}
