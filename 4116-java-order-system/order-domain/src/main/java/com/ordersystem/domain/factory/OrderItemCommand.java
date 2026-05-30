package com.ordersystem.domain.factory;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemCommand {

    private String skuId;
    private String skuName;
    private String skuImage;
    private BigDecimal price;
    private int quantity;
}
