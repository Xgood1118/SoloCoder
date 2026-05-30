package com.ordersystem.domain.validator;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderDiscountInfo;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class PromotionValidator implements OrderValidator {

    @Override
    public void validate(Order order) {
        OrderDiscountInfo discountInfo = order.getDiscountInfo();
        if (discountInfo == null) {
            return;
        }
        BigDecimal totalDiscount = BigDecimal.ZERO;
        if (discountInfo.getCouponAmount() != null) {
            totalDiscount = totalDiscount.add(discountInfo.getCouponAmount());
        }
        if (discountInfo.getPointAmount() != null) {
            totalDiscount = totalDiscount.add(discountInfo.getPointAmount());
        }
        if (discountInfo.getPromotionAmount() != null) {
            totalDiscount = totalDiscount.add(discountInfo.getPromotionAmount());
        }
        if (totalDiscount.compareTo(order.getTotalAmount()) > 0) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "优惠金额不能超过订单总金额");
        }
    }
}
