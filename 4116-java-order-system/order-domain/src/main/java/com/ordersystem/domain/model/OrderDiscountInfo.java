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
public class OrderDiscountInfo {

    private String couponId;
    private String couponName;
    private BigDecimal couponAmount;
    private BigDecimal pointAmount;
    private BigDecimal promotionAmount;
}
