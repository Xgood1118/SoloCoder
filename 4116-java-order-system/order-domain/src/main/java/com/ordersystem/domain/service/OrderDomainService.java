package com.ordersystem.domain.service;

import com.ordersystem.common.event.EventPublisher;
import com.ordersystem.common.event.OrderCreatedEvent;
import com.ordersystem.domain.factory.CreateOrderCommand;
import com.ordersystem.domain.factory.OrderFactory;
import com.ordersystem.domain.idempotent.OrderIdempotentService;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderType;
import com.ordersystem.domain.repository.OrderRepository;
import com.ordersystem.domain.validator.OrderValidatorChain;
import org.springframework.stereotype.Service;

@Service
public class OrderDomainService {

    private final OrderValidatorChain validatorChain;
    private final OrderIdempotentService idempotentService;
    private final OrderFactory orderFactory;
    private final OrderRepository orderRepository;
    private final EventPublisher eventPublisher;

    public OrderDomainService(OrderValidatorChain validatorChain,
                              OrderIdempotentService idempotentService,
                              OrderFactory orderFactory,
                              OrderRepository orderRepository,
                              EventPublisher eventPublisher) {
        this.validatorChain = validatorChain;
        this.idempotentService = idempotentService;
        this.orderFactory = orderFactory;
        this.orderRepository = orderRepository;
        this.eventPublisher = eventPublisher;
    }

    public Order createOrder(CreateOrderCommand command) {
        Order order = switch (command.getOrderType()) {
            case NORMAL -> orderFactory.createNormalOrder(command);
            case COMBO -> orderFactory.createComboOrder(command);
            case PRESALE -> orderFactory.createPresaleOrder(command);
            case VIRTUAL -> orderFactory.createVirtualOrder(command);
        };

        validatorChain.validate(order);

        idempotentService.checkAndMark(
                command.getUserId(),
                "CREATE_ORDER",
                String.valueOf(System.currentTimeMillis()));

        Order saved = orderRepository.save(order);

        OrderCreatedEvent event = new OrderCreatedEvent(
                saved.getOrderId(),
                saved.getUserId(),
                saved.getOrderType().name());
        eventPublisher.publish(event);

        return saved;
    }
}
