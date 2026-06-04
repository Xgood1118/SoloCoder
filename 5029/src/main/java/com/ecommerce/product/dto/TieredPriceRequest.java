package com.ecommerce.product.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TieredPriceRequest {

    @NotNull
    private Integer minQuantity;

    @NotNull
    private Integer maxQuantity;

    @NotNull
    private BigDecimal unitPrice;
}
