package com.ordersystem.query.model;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderDiscountVO {

    private Long couponId;
    private String couponName;
    private BigDecimal couponAmount;
    private BigDecimal pointAmount;
    private BigDecimal promotionAmount;
}
