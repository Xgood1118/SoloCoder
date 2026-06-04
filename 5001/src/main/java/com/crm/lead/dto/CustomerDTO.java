package com.crm.lead.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CustomerDTO {

    private Long id;

    @NotBlank(message = "公司名称不能为空")
    private String companyName;

    @NotNull(message = "客户类型不能为空")
    private Integer customerType;

    @NotBlank(message = "行业编码不能为空")
    private String industryCode;

    private String industryName;

    @NotNull(message = "省份不能为空")
    private Long provinceId;

    @NotNull(message = "城市不能为空")
    private Long cityId;

    private String address;

    private String website;

    private Integer employeeCount;

    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private BigDecimal annualRevenue;

    private String description;

    @Valid
    private List<CustomerContactDTO> contacts;

    @Valid
    private List<CustomerLicenseDTO> licenses;

    @Valid
    private List<CustomerDecisionChainDTO> decisionChains;
}
