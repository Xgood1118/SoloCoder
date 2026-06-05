package com.ecommerce.order.entity;

import com.ecommerce.order.serialize.LongToStringSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {
    private String skuId;
    private String skuName;
    private String productTitle;
    @JsonSerialize(using = LongToStringSerializer.class)
    private long unitPrice;
    private int quantity;
    @JsonSerialize(using = LongToStringSerializer.class)
    private long subtotal;
}
