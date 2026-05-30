package com.ordersystem.domain.validator;

import com.ordersystem.domain.model.Order;

public interface OrderValidator {

    void validate(Order order);
}
