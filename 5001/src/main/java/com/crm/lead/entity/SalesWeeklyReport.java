package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("sales_weekly_report")
public class SalesWeeklyReport {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String reportNo;

    private Long salespersonId;

    private String salespersonName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date weekStartDate;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date weekEndDate;

    private Integer newLeadCount;

    private Integer followedLeadCount;

    private Integer dealedLeadCount;

    private Integer closedLeadCount;

    private Integer poolLeadCount;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private BigDecimal totalDealAmount;

    private Integer unclosedLeadCount;

    private String unclosedReasonAnalysis;

    private String improvementMeasures;

    private String remark;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;
}
