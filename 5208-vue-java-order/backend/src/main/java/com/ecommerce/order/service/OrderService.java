package com.ecommerce.order.service;

import com.ecommerce.order.dto.*;
import com.ecommerce.order.entity.*;
import com.ecommerce.order.enums.OrderAction;
import com.ecommerce.order.enums.OrderStatus;
import com.ecommerce.order.exception.BusinessException;
import com.ecommerce.order.repository.OrderRepository;
import com.ecommerce.order.util.AmountUtil;
import com.ecommerce.order.vo.PageResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final NotificationService notificationService;
    private static final long PAY_TIMEOUT_MINUTES = 30;
    private static final long AUTO_CONFIRM_DAYS = 7;
    private static final long DISCOUNT_THRESHOLD = 10000L;
    private static final long DISCOUNT_AMOUNT = 500L;

    public Order createOrder(CreateOrderDTO dto) {
        String orderId = UUID.randomUUID().toString().replace("-", "");
        String orderNo = "ORD" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();

        List<OrderItem> items = dto.getItems().stream().map(itemDTO -> {
            long unitPrice = AmountUtil.yuanToFen(itemDTO.getUnitPrice());
            long subtotal = AmountUtil.multiply(unitPrice, itemDTO.getQuantity());
            return OrderItem.builder()
                    .skuId(itemDTO.getSkuId())
                    .skuName(itemDTO.getSkuName())
                    .productTitle(itemDTO.getProductTitle())
                    .unitPrice(unitPrice)
                    .quantity(itemDTO.getQuantity())
                    .subtotal(subtotal)
                    .build();
        }).collect(Collectors.toList());

        long totalAmount = items.stream().mapToLong(OrderItem::getSubtotal).sum();
        long discountAmount = AmountUtil.calculateDiscount(totalAmount, DISCOUNT_THRESHOLD, DISCOUNT_AMOUNT);
        long shippingFee = 0L;
        long paidAmount = AmountUtil.subtract(AmountUtil.add(totalAmount, shippingFee), discountAmount);
        if (paidAmount < 0) paidAmount = 0;

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expireAt = now.plusMinutes(PAY_TIMEOUT_MINUTES);

        Map<OrderStatus, LocalDateTime> statusTimestamps = new HashMap<>();
        statusTimestamps.put(OrderStatus.PENDING_PAYMENT, now);

        Order order = Order.builder()
                .id(orderId)
                .orderNo(orderNo)
                .userId(dto.getUserId())
                .items(items)
                .totalAmount(totalAmount)
                .discountAmount(discountAmount)
                .shippingFee(shippingFee)
                .paidAmount(paidAmount)
                .address(dto.getAddress())
                .status(OrderStatus.PENDING_PAYMENT)
                .remark(dto.getRemark())
                .createReason(dto.getCreateReason())
                .createdAt(now)
                .expireAt(expireAt)
                .statusTimestamps(statusTimestamps)
                .logistics(LogisticsInfo.builder().trackingRecords(new ArrayList<>()).build())
                .refundApplications(new ArrayList<>())
                .notificationIds(new ArrayList<>())
                .build();

        orderRepository.save(order);

        addOrderLog(orderId, dto.getOperatorId(), dto.getOperatorName(),
                OrderAction.CREATE, null, OrderStatus.PENDING_PAYMENT, dto.getCreateReason());

        notificationService.createNotification(
                dto.getUserId(),
                "订单创建成功",
                "您的订单 " + orderNo + " 已创建，请尽快支付",
                orderId
        );

        return order;
    }

    public Order getOrder(String id) {
        return orderRepository.findById(id).orElseThrow(BusinessException::orderNotFound);
    }

    public Order getOrderByOrderNo(String orderNo) {
        return orderRepository.findByOrderNo(orderNo).orElseThrow(BusinessException::orderNotFound);
    }

    public PageResult<Order> queryOrders(OrderQueryDTO dto) {
        List<Order> orders = orderRepository.findAll();

        if (dto.getStatus() != null && !dto.getStatus().isEmpty()) {
            OrderStatus status = OrderStatus.valueOf(dto.getStatus());
            orders = orders.stream().filter(o -> o.getStatus() == status).collect(Collectors.toList());
        }

        if (dto.getUserId() != null && !dto.getUserId().isEmpty()) {
            orders = orders.stream().filter(o -> o.getUserId().equals(dto.getUserId())).collect(Collectors.toList());
        }

        if (dto.getStartTime() != null) {
            orders = orders.stream().filter(o -> !o.getCreatedAt().isBefore(dto.getStartTime())).collect(Collectors.toList());
        }

        if (dto.getEndTime() != null) {
            orders = orders.stream().filter(o -> !o.getCreatedAt().isAfter(dto.getEndTime())).collect(Collectors.toList());
        }

        if (dto.getMinAmount() != null && !dto.getMinAmount().isEmpty()) {
            long minAmount = AmountUtil.yuanToFen(dto.getMinAmount());
            orders = orders.stream().filter(o -> o.getTotalAmount() >= minAmount).collect(Collectors.toList());
        }

        if (dto.getMaxAmount() != null && !dto.getMaxAmount().isEmpty()) {
            long maxAmount = AmountUtil.yuanToFen(dto.getMaxAmount());
            orders = orders.stream().filter(o -> o.getTotalAmount() <= maxAmount).collect(Collectors.toList());
        }

        if (dto.getProductKeyword() != null && !dto.getProductKeyword().isEmpty()) {
            String keyword = dto.getProductKeyword().toLowerCase();
            orders = orders.stream().filter(o ->
                    o.getItems().stream().anyMatch(item ->
                            (item.getSkuName() != null && item.getSkuName().toLowerCase().contains(keyword)) ||
                            (item.getProductTitle() != null && item.getProductTitle().toLowerCase().contains(keyword))
                    )
            ).collect(Collectors.toList());
        }

        if (dto.getSortBy() != null && !dto.getSortBy().isEmpty()) {
            Comparator<Order> comparator;
            switch (dto.getSortBy()) {
                case "amount":
                    comparator = Comparator.comparingLong(Order::getTotalAmount);
                    break;
                case "time":
                default:
                    comparator = Comparator.comparing(Order::getCreatedAt);
                    break;
            }
            if ("desc".equalsIgnoreCase(dto.getSortOrder())) {
                comparator = comparator.reversed();
            }
            orders.sort(comparator);
        } else {
            orders.sort(Comparator.comparing(Order::getCreatedAt).reversed());
        }

        long total = orders.size();
        int page = Math.max(dto.getPage(), 1);
        int size = Math.max(dto.getSize(), 1);
        int totalPages = (int) Math.ceil((double) total / size);

        int fromIndex = (page - 1) * size;
        int toIndex = Math.min(fromIndex + size, orders.size());
        List<Order> content = fromIndex < toIndex ? orders.subList(fromIndex, toIndex) : Collections.emptyList();

        return PageResult.<Order>builder()
                .content(content)
                .total(total)
                .page(page)
                .size(size)
                .totalPages(totalPages)
                .build();
    }

    public Order payOrder(String id) {
        Order order = getOrder(id);
        OrderStatus fromStatus = order.getStatus();

        if (!fromStatus.canTransitionTo(OrderStatus.PAID)) {
            throw BusinessException.invalidStatusTransition();
        }

        LocalDateTime now = LocalDateTime.now();
        order.setStatus(OrderStatus.PAID);
        order.setPaidAt(now);
        order.getStatusTimestamps().put(OrderStatus.PAID, now);

        orderRepository.save(order);

        addOrderLog(id, null, "系统", OrderAction.PAY, fromStatus, OrderStatus.PAID, "支付成功");
        notificationService.createNotification(
                order.getUserId(),
                "支付成功",
                "订单 " + order.getOrderNo() + " 支付成功，等待发货",
                id
        );

        return order;
    }

    public Order shipOrder(String id, ShipDTO dto) {
        Order order = getOrder(id);
        OrderStatus fromStatus = order.getStatus();

        if (!fromStatus.canTransitionTo(OrderStatus.SHIPPED)) {
            throw BusinessException.invalidStatusTransition();
        }

        LocalDateTime now = LocalDateTime.now();
        order.setStatus(OrderStatus.SHIPPED);
        order.setShippedAt(now);
        order.getStatusTimestamps().put(OrderStatus.SHIPPED, now);

        LogisticsInfo logistics = order.getLogistics();
        if (logistics == null) {
            logistics = new LogisticsInfo();
            logistics.setTrackingRecords(new ArrayList<>());
        }
        logistics.setTrackingNumber(dto.getTrackingNumber());
        logistics.setCompany(dto.getCompany());
        logistics.setCurrentStatus("已发货");
        logistics.addTrackingRecord(now, "仓库", "包裹已出库，物流公司：" + dto.getCompany() + "，运单号：" + dto.getTrackingNumber());
        order.setLogistics(logistics);

        orderRepository.save(order);

        addOrderLog(id, dto.getOperatorId(), dto.getOperatorName(),
                OrderAction.SHIP, fromStatus, OrderStatus.SHIPPED, dto.getRemark());
        notificationService.createNotification(
                order.getUserId(),
                "订单已发货",
                "订单 " + order.getOrderNo() + " 已发货，运单号：" + dto.getTrackingNumber(),
                id
        );

        return order;
    }

    public Order confirmOrder(String id, String operatorId, String operatorName) {
        Order order = getOrder(id);
        OrderStatus fromStatus = order.getStatus();

        if (!fromStatus.canTransitionTo(OrderStatus.RECEIVED)) {
            throw BusinessException.invalidStatusTransition();
        }

        LocalDateTime now = LocalDateTime.now();
        order.setStatus(OrderStatus.RECEIVED);
        order.setReceivedAt(now);
        order.getStatusTimestamps().put(OrderStatus.RECEIVED, now);

        if (order.getLogistics() != null) {
            order.getLogistics().setCurrentStatus("已签收");
            order.getLogistics().addTrackingRecord(now, "收件人地址", "包裹已签收");
        }

        orderRepository.save(order);

        addOrderLog(id, operatorId, operatorName,
                OrderAction.CONFIRM, fromStatus, OrderStatus.RECEIVED, null);
        notificationService.createNotification(
                order.getUserId(),
                "订单已完成",
                "订单 " + order.getOrderNo() + " 已确认收货，感谢您的购买",
                id
        );

        return order;
    }

    public Order cancelOrder(String id, String operatorId, String operatorName, String reason) {
        Order order = getOrder(id);
        OrderStatus fromStatus = order.getStatus();

        if (!fromStatus.canTransitionTo(OrderStatus.CANCELLED)) {
            throw BusinessException.invalidStatusTransition();
        }

        LocalDateTime now = LocalDateTime.now();
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledAt(now);
        order.getStatusTimestamps().put(OrderStatus.CANCELLED, now);

        orderRepository.save(order);

        addOrderLog(id, operatorId, operatorName,
                OrderAction.CANCEL, fromStatus, OrderStatus.CANCELLED, reason);
        notificationService.createNotification(
                order.getUserId(),
                "订单已取消",
                "订单 " + order.getOrderNo() + " 已取消，原因：" + (reason != null ? reason : "用户取消"),
                id
        );

        return order;
    }

    public RefundApplication applyRefund(String orderId, RefundDTO dto) {
        Order order = getOrder(orderId);
        OrderStatus fromStatus = order.getStatus();

        if (fromStatus == OrderStatus.REFUNDED || fromStatus == OrderStatus.CANCELLED) {
            throw BusinessException.invalidStatusTransition();
        }

        long refundAmount;
        boolean isPartial = dto.isPartial();
        if (isPartial && dto.getRefundAmount() != null && !dto.getRefundAmount().isEmpty()) {
            refundAmount = AmountUtil.yuanToFen(dto.getRefundAmount());
            if (refundAmount >= order.getPaidAmount()) {
                isPartial = false;
                refundAmount = order.getPaidAmount();
            }
        } else {
            refundAmount = order.getPaidAmount();
            isPartial = false;
        }

        RefundApplication.RefundType type = dto.isReturn() ? RefundApplication.RefundType.RETURN : RefundApplication.RefundType.NORMAL;

        RefundApplication application = RefundApplication.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .orderId(orderId)
                .reason(dto.getReason())
                .refundAmount(refundAmount)
                .type(type)
                .status(RefundApplication.RefundStatus.PENDING)
                .applicantId(dto.getApplicantId())
                .appliedAt(LocalDateTime.now())
                .isPartial(isPartial)
                .build();

        order.getRefundApplications().add(application);
        orderRepository.save(order);
        orderRepository.saveRefundApplication(application);

        addOrderLog(orderId, dto.getApplicantId(), dto.getApplicantName(),
                OrderAction.REFUND, fromStatus, fromStatus,
                "申请退款" + (isPartial ? "（部分退款）" : "") + "，金额：" + AmountUtil.fenToYuan(refundAmount) + "元，原因：" + dto.getReason());

        return application;
    }

    public RefundApplication auditRefund(String refundId, RefundAuditDTO dto) {
        RefundApplication application = orderRepository.findRefundApplicationById(refundId)
                .orElseThrow(() -> new BusinessException(404, "退款申请不存在"));

        if (application.getStatus() != RefundApplication.RefundStatus.PENDING) {
            throw new BusinessException(400, "退款申请已处理");
        }

        Order order = getOrder(application.getOrderId());
        OrderStatus fromStatus = order.getStatus();

        application.setAuditorId(dto.getAuditorId());
        application.setAuditedAt(LocalDateTime.now());

        if (dto.isApproved()) {
            application.setStatus(RefundApplication.RefundStatus.APPROVED);

            if (!application.isPartial()) {
                if (!fromStatus.canTransitionTo(OrderStatus.REFUNDED)) {
                    throw BusinessException.invalidStatusTransition();
                }
                LocalDateTime now = LocalDateTime.now();
                order.setStatus(OrderStatus.REFUNDED);
                order.setRefundedAt(now);
                order.getStatusTimestamps().put(OrderStatus.REFUNDED, now);
                orderRepository.save(order);
            }

            orderRepository.saveRefundApplication(application);

            addOrderLog(order.getId(), dto.getAuditorId(), dto.getAuditorName(),
                    OrderAction.REFUND_APPROVE, fromStatus,
                    application.isPartial() ? fromStatus : OrderStatus.REFUNDED,
                    "退款审核通过" + (application.isPartial() ? "（部分退款）" : "") + "，金额：" + AmountUtil.fenToYuan(application.getRefundAmount()) + "元");

            notificationService.createNotification(
                    order.getUserId(),
                    "退款审核通过",
                    "订单 " + order.getOrderNo() + " 的退款申请已通过，金额：" + AmountUtil.fenToYuan(application.getRefundAmount()) + "元",
                    order.getId()
            );
        } else {
            application.setStatus(RefundApplication.RefundStatus.REJECTED);
            application.setRejectReason(dto.getRejectReason());
            orderRepository.saveRefundApplication(application);

            addOrderLog(order.getId(), dto.getAuditorId(), dto.getAuditorName(),
                    OrderAction.REFUND_REJECT, fromStatus, fromStatus,
                    "退款审核驳回，原因：" + dto.getRejectReason());

            notificationService.createNotification(
                    order.getUserId(),
                    "退款申请被驳回",
                    "订单 " + order.getOrderNo() + " 的退款申请被驳回，原因：" + dto.getRejectReason(),
                    order.getId()
            );
        }

        return application;
    }

    public Order updateOrder(String id, Map<String, Object> updates) {
        Order order = getOrder(id);

        if (updates.containsKey("remark")) {
            order.setRemark((String) updates.get("remark"));
        }
        if (updates.containsKey("address")) {
            @SuppressWarnings("unchecked")
            Map<String, String> addrMap = (Map<String, String>) updates.get("address");
            Address address = order.getAddress();
            if (address == null) address = new Address();
            if (addrMap.containsKey("name")) address.setName(addrMap.get("name"));
            if (addrMap.containsKey("phone")) address.setPhone(addrMap.get("phone"));
            if (addrMap.containsKey("province")) address.setProvince(addrMap.get("province"));
            if (addrMap.containsKey("city")) address.setCity(addrMap.get("city"));
            if (addrMap.containsKey("district")) address.setDistrict(addrMap.get("district"));
            if (addrMap.containsKey("detail")) address.setDetail(addrMap.get("detail"));
            order.setAddress(address);
        }

        return orderRepository.save(order);
    }

    public LogisticsInfo addTrackingRecord(String orderId, LogisticsDTO dto) {
        Order order = getOrder(orderId);
        LogisticsInfo logistics = order.getLogistics();
        if (logistics == null) {
            logistics = new LogisticsInfo();
            logistics.setTrackingRecords(new ArrayList<>());
            order.setLogistics(logistics);
        }

        logistics.addTrackingRecord(LocalDateTime.now(), dto.getLocation(), dto.getDescription());
        orderRepository.save(order);

        addOrderLog(orderId, dto.getOperatorId(), dto.getOperatorName(),
                OrderAction.UPDATE_LOGISTICS, order.getStatus(), order.getStatus(),
                "更新物流：" + dto.getDescription());

        return logistics;
    }

    public List<OrderLog> getOrderLogs(String orderId) {
        return orderRepository.findLogsByOrderId(orderId);
    }

    private void addOrderLog(String orderId, String operatorId, String operatorName,
                             OrderAction action, OrderStatus fromStatus, OrderStatus toStatus, String remark) {
        OrderLog orderLog = OrderLog.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .orderId(orderId)
                .operatorId(operatorId)
                .operatorName(operatorName != null ? operatorName : "系统")
                .action(action)
                .fromStatus(fromStatus)
                .toStatus(toStatus)
                .timestamp(LocalDateTime.now())
                .remark(remark)
                .build();
        orderRepository.saveLog(orderLog);
    }

    public Map<String, Object> batchShip(List<String> orderIds, ShipDTO dto) {
        List<String> successIds = new ArrayList<>();
        List<String> failedIds = new ArrayList<>();
        Map<String, String> failedReasons = new HashMap<>();

        for (String orderId : orderIds) {
            try {
                Order order = getOrder(orderId);
                if (order.getStatus() != OrderStatus.PAID) {
                    failedIds.add(orderId);
                    failedReasons.put(orderId, "状态不是已支付");
                    continue;
                }
                shipOrder(orderId, dto);
                successIds.add(orderId);
            } catch (Exception e) {
                failedIds.add(orderId);
                failedReasons.put(orderId, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successIds", successIds);
        result.put("failedIds", failedIds);
        result.put("failedReasons", failedReasons);
        return result;
    }

    public Map<String, Object> batchConfirm(List<String> orderIds, String operatorId, String operatorName) {
        List<String> successIds = new ArrayList<>();
        List<String> failedIds = new ArrayList<>();
        Map<String, String> failedReasons = new HashMap<>();

        for (String orderId : orderIds) {
            try {
                Order order = getOrder(orderId);
                if (order.getStatus() != OrderStatus.SHIPPED) {
                    failedIds.add(orderId);
                    failedReasons.put(orderId, "状态不是已发货");
                    continue;
                }
                confirmOrder(orderId, operatorId, operatorName);
                successIds.add(orderId);
            } catch (Exception e) {
                failedIds.add(orderId);
                failedReasons.put(orderId, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successIds", successIds);
        result.put("failedIds", failedIds);
        result.put("failedReasons", failedReasons);
        return result;
    }

    public List<Order> getOrdersForExport(OrderQueryDTO dto) {
        dto.setPage(1);
        dto.setSize(Integer.MAX_VALUE);
        return queryOrders(dto).getContent();
    }

    public void processExpiredOrders() {
        LocalDateTime now = LocalDateTime.now();
        List<Order> expiredOrders = orderRepository.findAll().stream()
                .filter(o -> o.getStatus() == OrderStatus.PENDING_PAYMENT
                        && o.getExpireAt() != null
                        && o.getExpireAt().isBefore(now))
                .collect(Collectors.toList());

        for (Order order : expiredOrders) {
            try {
                cancelOrder(order.getId(), "system", "系统", "支付超时自动取消");
            } catch (Exception e) {
                log.error("自动取消订单失败: {}", order.getId(), e);
            }
        }
    }

    public void processAutoConfirm() {
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(AUTO_CONFIRM_DAYS);
        List<Order> shippedOrders = orderRepository.findAll().stream()
                .filter(o -> o.getStatus() == OrderStatus.SHIPPED
                        && o.getShippedAt() != null
                        && o.getShippedAt().isBefore(sevenDaysAgo))
                .collect(Collectors.toList());

        for (Order order : shippedOrders) {
            try {
                OrderStatus fromStatus = order.getStatus();
                LocalDateTime now = LocalDateTime.now();
                order.setStatus(OrderStatus.RECEIVED);
                order.setReceivedAt(now);
                order.getStatusTimestamps().put(OrderStatus.RECEIVED, now);

                if (order.getLogistics() != null) {
                    order.getLogistics().setCurrentStatus("已签收");
                    order.getLogistics().addTrackingRecord(now, "系统", "超时自动确认收货");
                }

                orderRepository.save(order);

                addOrderLog(order.getId(), "system", "系统",
                        OrderAction.AUTO_CONFIRM, fromStatus, OrderStatus.RECEIVED,
                        "发货超过7天自动确认收货");

                notificationService.createNotification(
                        order.getUserId(),
                        "订单已自动确认收货",
                        "订单 " + order.getOrderNo() + " 因超时已自动确认收货",
                        order.getId()
                );
            } catch (Exception e) {
                log.error("自动确认收货失败: {}", order.getId(), e);
            }
        }
    }
}
