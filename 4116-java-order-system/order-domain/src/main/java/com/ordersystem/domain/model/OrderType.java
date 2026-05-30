package com.ordersystem.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum OrderType {

    NORMAL(1, "普通订单"),
    COMBO(2, "组合套餐订单"),
    PRESALE(3, "预售订单"),
    VIRTUAL(4, "虚拟商品订单");

    private final int code;
    private final String desc;
}
