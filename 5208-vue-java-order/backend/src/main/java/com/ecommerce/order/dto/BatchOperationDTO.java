package com.ecommerce.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchOperationDTO {
    @NotEmpty(message = "订单ID列表不能为空")
    private List<String> orderIds;
    private String operatorId;
    private String operatorName;
}
