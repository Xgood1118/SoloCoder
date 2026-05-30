package com.ordersystem.domain.factory;

import com.ordersystem.common.id.IdGenerator;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderItem;
import com.ordersystem.domain.model.OrderType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class OrderFactory {

    private final IdGenerator idGenerator;

    public OrderFactory(IdGenerator idGenerator) {
        this.idGenerator = idGenerator;
    }

    public Order createNormalOrder(CreateOrderCommand command) {
        return buildOrder(command, OrderType.NORMAL);
    }

    public Order createComboOrder(CreateOrderCommand command) {
        return buildOrder(command, OrderType.COMBO);
    }

    public Order createPresaleOrder(CreateOrderCommand command) {
        return buildOrder(command, OrderType.PRESALE);
    }

    public Order createVirtualOrder(CreateOrderCommand command) {
        return buildOrder(command, OrderType.VIRTUAL);
    }

    private Order buildOrder(CreateOrderCommand command, OrderType orderType) {
        String orderId = idGenerator.nextOrderId();
        String orderNo = generateOrderNo(orderType);

        List<OrderItem> items = command.getItems().stream()
                .map(cmd -> OrderItem.create(
                        idGenerator.nextOrderId(),
                        cmd.getSkuId(),
                        cmd.getSkuName(),
                        cmd.getSkuImage(),
                        cmd.getPrice(),
                        cmd.getQuantity()))
                .collect(Collectors.toList());

        return Order.create(orderId, orderNo, command.getUserId(), null, orderType,
                items, command.getAddress(), command.getDiscountInfo(), command.getRemark());
    }

    private String generateOrderNo(OrderType orderType) {
        return orderType.name() + idGenerator.nextOrderId();
    }
}
