package com.ecommerce.order.entity;

import com.ecommerce.order.serialize.LongToStringSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundApplication {
    private String id;
    private String orderId;
    private String reason;
    private String rejectReason;
    @JsonSerialize(using = LongToStringSerializer.class)
    private long refundAmount;
    private RefundType type;
    private RefundStatus status;
    private String applicantId;
    private String auditorId;
    private LocalDateTime appliedAt;
    private LocalDateTime auditedAt;
    private boolean isPartial;

    public enum RefundType {
        NORMAL("普通退款"),
        RETURN("退货退款");

        private final String description;

        RefundType(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    public enum RefundStatus {
        PENDING("待审核"),
        APPROVED("已通过"),
        REJECTED("已驳回");

        private final String description;

        RefundStatus(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }
}
