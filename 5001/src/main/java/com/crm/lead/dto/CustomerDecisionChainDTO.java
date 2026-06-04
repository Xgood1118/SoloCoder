package com.crm.lead.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class CustomerDecisionChainDTO {

    private Long id;

    private Long customerId;

    @NotBlank(message = "角色类型不能为空")
    private String roleType;

    @NotBlank(message = "联系人姓名不能为空")
    private String contactName;

    private String position;

    private String phone;

    private String email;

    private Integer influenceLevel;

    private Integer supportAttitude;

    private String remark;

    private Integer sortOrder;
}
