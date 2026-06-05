package com.ecommerce.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchShipDTO {
    @NotEmpty(message = "订单ID列表不能为空")
    private List<String> orderIds;
    @NotBlank(message = "运单号不能为空")
    private String trackingNumber;
    @NotBlank(message = "物流公司不能为空")
    private String company;
    private String operatorId;
    private String operatorName;
}
