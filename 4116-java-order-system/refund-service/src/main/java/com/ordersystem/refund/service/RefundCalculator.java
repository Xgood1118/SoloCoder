package com.ordersystem.refund.service;

import com.ordersystem.refund.model.RefundCalculationRule;
import com.ordersystem.refund.model.RefundReason;
import com.ordersystem.refund.model.RefundType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Component
public class RefundCalculator {

    private final List<RefundCalculationRule> rules = new ArrayList<>();

    public RefundCalculator() {
        rules.add(new RefundCalculationRule(RefundReason.BUYER_CANCEL, "NORMAL", BigDecimal.ZERO));
        rules.add(new RefundCalculationRule(RefundReason.BUYER_AFTER_SALE, "NORMAL", new BigDecimal("0.02")));
        rules.add(new RefundCalculationRule(RefundReason.SELLER_NEGOTIATE, "NORMAL", BigDecimal.ZERO));
        rules.add(new RefundCalculationRule(RefundReason.BUYER_CANCEL, "PRESALE", new BigDecimal("0.05")));
        rules.add(new RefundCalculationRule(RefundReason.BUYER_AFTER_SALE, "PRESALE", new BigDecimal("0.05")));
        rules.add(new RefundCalculationRule(RefundReason.SELLER_NEGOTIATE, "PRESALE", new BigDecimal("0.05")));
    }

    public BigDecimal calculatePenaltyAmount(BigDecimal originalAmount, RefundReason refundReason, String orderType) {
        BigDecimal penaltyRate = getPenaltyRate(refundReason, orderType);
        return originalAmount.multiply(penaltyRate).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateRefundAmount(BigDecimal originalAmount, RefundReason refundReason, RefundType refundType, String orderType) {
        BigDecimal penaltyAmount = calculatePenaltyAmount(originalAmount, refundReason, orderType);
        return originalAmount.subtract(penaltyAmount).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal getPenaltyRate(RefundReason refundReason, String orderType) {
        if ("PRESALE".equals(orderType)) {
            return new BigDecimal("0.05");
        }
        return rules.stream()
                .filter(r -> r.getRefundReason() == refundReason && r.getOrderType().equals(orderType))
                .findFirst()
                .map(RefundCalculationRule::getPenaltyRate)
                .orElse(BigDecimal.ZERO);
    }
}
