package com.ordersystem.domain.validator;

import com.ordersystem.common.exception.BizException;
import com.ordersystem.common.exception.CommonErrorCode;
import com.ordersystem.domain.model.Order;
import org.springframework.stereotype.Component;

@Component
public class UserQualificationValidator implements OrderValidator {

    @Override
    public void validate(Order order) {
        if (order.getUserId() == null || order.getUserId().isBlank()) {
            throw new BizException(CommonErrorCode.PARAM_ERROR, "用户ID不能为空");
        }
    }
}
