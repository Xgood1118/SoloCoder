package com.ecommerce.promotion.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PromotionCalculateRequest {

    private List<OrderItemInfo> items;

    private String couponCode;

    @Data
    public static class OrderItemInfo {

        private Long productId;

        private Long skuId;

        private Integer quantity;

        private BigDecimal unitPrice;

        private BigDecimal subtotal;
    }
}
