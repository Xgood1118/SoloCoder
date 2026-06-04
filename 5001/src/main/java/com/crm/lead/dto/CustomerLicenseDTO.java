package com.crm.lead.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.Date;

@Data
public class CustomerLicenseDTO {

    private Long id;

    private Long customerId;

    @NotBlank(message = "证照类型不能为空")
    private String licenseType;

    @NotBlank(message = "证照编号不能为空")
    private String licenseNo;

    @NotBlank(message = "证照名称不能为空")
    private String licenseName;

    @JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")
    private Date issueDate;

    @JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")
    private Date expiryDate;

    private String fileUrl;

    private String remark;
}
