package com.ecommerce.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderQueryDTO {
    private String status;
    private String userId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String minAmount;
    private String maxAmount;
    private String productKeyword;
    private String sortBy;
    private String sortOrder;
    @Builder.Default
    private int page = 1;
    @Builder.Default
    private int size = 10;
}
