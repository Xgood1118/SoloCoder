package com.ecommerce.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemDTO {
    @NotBlank(message = "SKU ID不能为空")
    private String skuId;
    private String skuName;
    private String productTitle;
    @NotNull(message = "单价不能为空")
    private String unitPrice;
    @Min(value = 1, message = "数量至少为1")
    private int quantity;
}
