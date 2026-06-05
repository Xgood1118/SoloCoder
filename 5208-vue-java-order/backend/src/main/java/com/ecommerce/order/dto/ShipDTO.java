package com.ecommerce.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShipDTO {
    @NotBlank(message = "运单号不能为空")
    private String trackingNumber;
    @NotBlank(message = "物流公司不能为空")
    private String company;
    private String operatorId;
    private String operatorName;
    private String remark;
}
