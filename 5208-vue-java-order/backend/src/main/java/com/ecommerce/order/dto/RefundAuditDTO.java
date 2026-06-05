package com.ecommerce.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundAuditDTO {
    private boolean approved;
    private String rejectReason;
    private String auditorId;
    private String auditorName;
}
