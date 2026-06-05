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
public class RefundDTO {
    @NotBlank(message = "退款原因不能为空")
    private String reason;
    private String refundAmount;
    private boolean isReturn;
    private boolean isPartial;
    private String applicantId;
    private String applicantName;
}
