package com.ecommerce.promotion.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PromotionCalculateResult {

    private BigDecimal originalAmount;

    private BigDecimal totalDiscount;

    private BigDecimal finalAmount;

    private List<DiscountDetail> discountDetails;

    @Data
    public static class DiscountDetail {

        private String promotionName;

        private String promotionType;

        private BigDecimal discountAmount;

        private String description;
    }
}
