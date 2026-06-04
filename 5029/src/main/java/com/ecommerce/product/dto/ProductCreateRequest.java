package com.ecommerce.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductCreateRequest {

    @NotBlank(message = "Product name is required")
    private String name;

    private String description;

    private String category;

    private String imageUrl;

    private List<SkuRequest> skus;

    @Data
    public static class SkuRequest {

        @NotBlank(message = "SKU code is required")
        private String skuCode;

        private String attributes;

        @NotNull(message = "Price is required")
        private BigDecimal price;

        private BigDecimal costPrice;
    }
}
