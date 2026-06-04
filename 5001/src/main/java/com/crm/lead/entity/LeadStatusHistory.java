package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("lead_status_history")
public class LeadStatusHistory {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long leadId;

    private String oldStatus;

    private String newStatus;

    private Long oldSalespersonId;

    private Long newSalespersonId;

    private String changeReason;

    private String remark;

    private Long operatorId;

    private String operatorName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date operateTime;
}
