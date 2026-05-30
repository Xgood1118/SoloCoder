package com.ordersystem.query.model;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderItemVO {

    private Long itemId;
    private Long skuId;
    private String skuName;
    private String skuImage;
    private BigDecimal price;
    private Integer quantity;
    private BigDecimal subTotalAmount;
}
