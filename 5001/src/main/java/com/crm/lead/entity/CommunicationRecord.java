package com.crm.lead.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
@TableName("communication_record")
public class CommunicationRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long leadId;

    private Long customerId;

    private Long salespersonId;

    private String commType;

    private String content;

    private String fileUrl;

    private Integer voiceDuration;

    private Integer transcriptStatus;

    private String transcriptContent;

    private String contactPerson;

    private String commResult;

    private String nextAction;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date nextActionTime;

    @TableLogic
    private Integer isDeleted;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date updatedTime;
}
