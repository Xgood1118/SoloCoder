package com.ordersystem.domain.validator;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderItem;
import org.springframework.stereotype.Component;

@Component
public class StockValidator implements OrderValidator {

    @Override
    public void validate(Order order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "订单明细不能为空");
        }
        for (OrderItem item : order.getItems()) {
            if (item.getQuantity() <= 0) {
                throw new BizException(CommonErrorCode.INSUFFICIENT_STOCK,
                        "商品 " + item.getSkuName() + " 数量不合法");
            }
        }
    }
}
