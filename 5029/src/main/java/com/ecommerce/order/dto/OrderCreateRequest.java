package com.ecommerce.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class OrderCreateRequest {

    @NotBlank(message = "Customer name is required")
    private String customerName;

    @NotEmpty(message = "Order items cannot be empty")
    private List<OrderItemRequest> items;

    private String couponCode;

    @Data
    public static class OrderItemRequest {

        @NotNull(message = "SKU ID is required")
        private Long skuId;

        @NotNull(message = "Product ID is required")
        private Long productId;

        @NotNull(message = "Quantity is required")
        private Integer quantity;
    }
}
