package com.crm.lead.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.Date;

@Data
public class CommunicationRecordDTO {

    @NotNull(message = "线索ID不能为空")
    private Long leadId;

    @NotNull(message = "客户ID不能为空")
    private Long customerId;

    @NotNull(message = "销售人员ID不能为空")
    private Long salespersonId;

    @NotBlank(message = "沟通类型不能为空")
    private String commType;

    @NotBlank(message = "沟通内容不能为空")
    private String content;

    private String fileUrl;

    private Integer voiceDuration;

    private String contactPerson;

    private String commResult;

    private String nextAction;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date nextActionTime;
}
