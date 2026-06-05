package com.ecommerce.order.dto;

import com.ecommerce.order.entity.Address;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.Valid;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrderDTO {
    @NotNull(message = "用户ID不能为空")
    private String userId;
    @NotEmpty(message = "商品列表不能为空")
    @Valid
    private List<OrderItemDTO> items;
    @NotNull(message = "收货地址不能为空")
    @Valid
    private Address address;
    private String remark;
    private String createReason;
    private String operatorId;
    private String operatorName;
}
