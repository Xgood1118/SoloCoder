package com.ordersystem.domain.validator;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderItem;
import org.springframework.stereotype.Component;

@Component
public class ProductStatusValidator implements OrderValidator {

    @Override
    public void validate(Order order) {
        if (order.getItems() == null) {
            return;
        }
        for (OrderItem item : order.getItems()) {
            if (item.getSkuId() == null || item.getSkuId().isBlank()) {
                throw new BizException(CommonErrorCode.PARAM_ERROR, "商品SKU不能为空");
            }
            if (item.getSkuName() == null || item.getSkuName().isBlank()) {
                throw new BizException(CommonErrorCode.PARAM_ERROR, "商品名称不能为空");
            }
        }
    }
}
