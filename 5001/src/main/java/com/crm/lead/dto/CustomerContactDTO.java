package com.crm.lead.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class CustomerContactDTO {

    private Long id;

    private Long customerId;

    @NotBlank(message = "联系人姓名不能为空")
    private String contactName;

    private Integer contactRole;

    private String position;

    @NotBlank(message = "联系电话不能为空")
    private String phone;

    private String email;

    private String wechat;

    private Integer isDecisionMaker;

    private String remark;
}
