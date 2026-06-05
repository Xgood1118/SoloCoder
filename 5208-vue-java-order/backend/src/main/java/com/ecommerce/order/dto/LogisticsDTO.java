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
public class LogisticsDTO {
    @NotBlank(message = "轨迹描述不能为空")
    private String description;
    private String location;
    private String operatorId;
    private String operatorName;
}
