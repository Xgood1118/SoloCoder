package com.ecommerce.order.dto;

import lombok.Data;

public class OrderStatusChangeRequest {

    @Data
    public static class StatusChange {
        private String changedBy;
        private String remark;
    }
}
