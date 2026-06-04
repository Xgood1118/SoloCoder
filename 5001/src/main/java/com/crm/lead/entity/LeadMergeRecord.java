package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("lead_merge_record")
public class LeadMergeRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long mainLeadId;

    private Long mergedLeadId;

    private Long customerId;

    private String mergeReason;

    private Long operatorId;

    private String operatorName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date mergeTime;
}
