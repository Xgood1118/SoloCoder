package com.ordersystem.domain.validator;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderItem;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class PriceValidator implements OrderValidator {

    @Override
    public void validate(Order order) {
        if (order.getTotalAmount() == null || order.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "订单总金额必须大于0");
        }
        if (order.getPayAmount() == null || order.getPayAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "订单实付金额不能为负数");
        }
        for (OrderItem item : order.getItems()) {
            if (item.getPrice() == null || item.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BizException(CommonErrorCode.PARAM_ERROR,
                        "商品 " + item.getSkuName() + " 价格必须大于0");
            }
        }
    }
}
