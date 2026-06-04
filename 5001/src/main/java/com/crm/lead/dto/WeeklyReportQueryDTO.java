package com.crm.lead.dto;

import com.crm.lead.common.PageQuery;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.util.Date;

@Data
public class WeeklyReportQueryDTO extends PageQuery {

    private Long salespersonId;

    @JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")
    private Date weekStartDate;

    @JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")
    private Date weekEndDate;
}
