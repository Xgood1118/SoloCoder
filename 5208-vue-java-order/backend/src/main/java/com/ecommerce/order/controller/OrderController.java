package com.ecommerce.order.controller;

import com.ecommerce.order.dto.*;
import com.ecommerce.order.entity.Order;
import com.ecommerce.order.entity.OrderLog;
import com.ecommerce.order.entity.RefundApplication;
import com.ecommerce.order.service.ExportService;
import com.ecommerce.order.service.OrderService;
import com.ecommerce.order.vo.PageResult;
import com.ecommerce.order.vo.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    private final ExportService exportService;

    @PostMapping
    public Result<Order> createOrder(@Valid @RequestBody CreateOrderDTO dto) {
        return Result.success(orderService.createOrder(dto));
    }

    @GetMapping
    public Result<PageResult<Order>> getOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(required = false) String minAmount,
            @RequestParam(required = false) String maxAmount,
            @RequestParam(required = false) String productKeyword,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        OrderQueryDTO dto = OrderQueryDTO.builder()
                .status(status)
                .userId(userId)
                .startTime(startTime)
                .endTime(endTime)
                .minAmount(minAmount)
                .maxAmount(maxAmount)
                .productKeyword(productKeyword)
                .sortBy(sortBy)
                .sortOrder(sortOrder)
                .page(page)
                .size(size)
                .build();
        return Result.success(orderService.queryOrders(dto));
    }

    @GetMapping("/{id}")
    public Result<Order> getOrder(@PathVariable String id) {
        return Result.success(orderService.getOrder(id));
    }

    @PatchMapping("/{id}")
    public Result<Order> updateOrder(@PathVariable String id, @RequestBody Map<String, Object> updates) {
        return Result.success(orderService.updateOrder(id, updates));
    }

    @PostMapping("/{id}/pay")
    public Result<Order> payOrder(@PathVariable String id) {
        return Result.success(orderService.payOrder(id));
    }

    @PostMapping("/{id}/ship")
    public Result<Order> shipOrder(@PathVariable String id, @Valid @RequestBody ShipDTO dto) {
        return Result.success(orderService.shipOrder(id, dto));
    }

    @PostMapping("/{id}/confirm")
    public Result<Order> confirmOrder(@PathVariable String id,
                                      @RequestParam(required = false) String operatorId,
                                      @RequestParam(required = false) String operatorName) {
        return Result.success(orderService.confirmOrder(id, operatorId, operatorName));
    }

    @PostMapping("/{id}/cancel")
    public Result<Order> cancelOrder(@PathVariable String id,
                                     @RequestParam(required = false) String operatorId,
                                     @RequestParam(required = false) String operatorName,
                                     @RequestParam(required = false) String reason) {
        return Result.success(orderService.cancelOrder(id, operatorId, operatorName, reason));
    }

    @PostMapping("/{id}/refund")
    public Result<RefundApplication> applyRefund(@PathVariable String id, @Valid @RequestBody RefundDTO dto) {
        return Result.success(orderService.applyRefund(id, dto));
    }

    @PostMapping("/refund/{refundId}/audit")
    public Result<RefundApplication> auditRefund(@PathVariable String refundId, @Valid @RequestBody RefundAuditDTO dto) {
        return Result.success(orderService.auditRefund(refundId, dto));
    }

    @GetMapping("/{id}/logs")
    public Result<List<OrderLog>> getOrderLogs(@PathVariable String id) {
        return Result.success(orderService.getOrderLogs(id));
    }

    @PostMapping("/{id}/logistics")
    public Result<?> addTrackingRecord(@PathVariable String id, @Valid @RequestBody LogisticsDTO dto) {
        return Result.success(orderService.addTrackingRecord(id, dto));
    }

    @PostMapping("/batch/ship")
    public Result<Map<String, Object>> batchShip(@Valid @RequestBody BatchShipDTO dto) {
        return Result.success(orderService.batchShip(dto.getOrderIds(), ShipDTO.builder()
                .trackingNumber(dto.getTrackingNumber())
                .company(dto.getCompany())
                .operatorId(dto.getOperatorId())
                .operatorName(dto.getOperatorName())
                .build()));
    }

    @PostMapping("/batch/confirm")
    public Result<Map<String, Object>> batchConfirm(@Valid @RequestBody BatchOperationDTO dto) {
        return Result.success(orderService.batchConfirm(dto.getOrderIds(), dto.getOperatorId(), dto.getOperatorName()));
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCSV(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(required = false) String minAmount,
            @RequestParam(required = false) String maxAmount,
            @RequestParam(required = false) String productKeyword
    ) {
        OrderQueryDTO dto = OrderQueryDTO.builder()
                .status(status)
                .userId(userId)
                .startTime(startTime)
                .endTime(endTime)
                .minAmount(minAmount)
                .maxAmount(maxAmount)
                .productKeyword(productKeyword)
                .build();

        byte[] csvData = exportService.exportOrdersToCSV(dto);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "orders.csv");

        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }
}
