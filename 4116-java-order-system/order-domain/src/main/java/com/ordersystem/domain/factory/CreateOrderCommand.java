package com.ordersystem.domain.factory;

import com.ordersystem.domain.model.OrderAddress;
import com.ordersystem.domain.model.OrderDiscountInfo;
import com.ordersystem.domain.model.OrderType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrderCommand {

    private String userId;
    private OrderType orderType;
    private List<OrderItemCommand> items;
    private OrderAddress address;
    private OrderDiscountInfo discountInfo;
    private String remark;
}
