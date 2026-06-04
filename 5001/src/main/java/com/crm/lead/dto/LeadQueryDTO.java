package com.crm.lead.dto;

import com.crm.lead.common.PageQuery;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
public class LeadQueryDTO extends PageQuery {

    private String leadNo;

    private String leadStatus;

    private Integer importanceLevel;

    private Long salespersonId;

    private Long customerId;

    private Long sourceId;

    private Long cityId;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date startTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date endTime;
}
