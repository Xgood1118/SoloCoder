package com.ordersystem.domain.validator;

import com.ordersystem.domain.model.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OrderValidatorChain {

    private final List<OrderValidator> validators;

    public OrderValidatorChain(List<OrderValidator> validators) {
        this.validators = validators;
    }

    public void validate(Order order) {
        for (OrderValidator validator : validators) {
            validator.validate(order);
        }
    }
}
