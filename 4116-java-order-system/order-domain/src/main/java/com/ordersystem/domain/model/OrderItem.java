package com.ordersystem.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {

    private String itemId;
    private String skuId;
    private String skuName;
    private String skuImage;
    private BigDecimal price;
    private int quantity;
    private BigDecimal subTotalAmount;

    public static OrderItem create(String itemId, String skuId, String skuName, String skuImage,
                                   BigDecimal price, int quantity) {
        return OrderItem.builder()
                .itemId(itemId)
                .skuId(skuId)
                .skuName(skuName)
                .skuImage(skuImage)
                .price(price)
                .quantity(quantity)
                .subTotalAmount(price.multiply(BigDecimal.valueOf(quantity)))
                .build();
    }
}
