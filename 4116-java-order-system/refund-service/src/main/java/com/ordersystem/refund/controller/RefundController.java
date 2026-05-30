package com.ordersystem.refund.controller;

import com.ordersystem.common.result.ApiResult;
import com.ordersystem.refund.model.RefundApplyRequest;
import com.ordersystem.refund.model.RefundOrder;
import com.ordersystem.refund.service.RefundService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/refund")
public class RefundController {

    private final RefundService refundService;

    public RefundController(RefundService refundService) {
        this.refundService = refundService;
    }

    @PostMapping("/apply")
    public ApiResult<RefundOrder> applyRefund(@Valid @RequestBody RefundApplyRequest request) {
        return ApiResult.success(refundService.applyRefund(request));
    }

    @PostMapping("/audit")
    public ApiResult<RefundOrder> auditRefund(@RequestParam String refundId,
                                               @RequestParam boolean approved,
                                               @RequestParam String auditor,
                                               @RequestParam(required = false) String remark) {
        return ApiResult.success(refundService.auditRefund(refundId, approved, auditor, remark));
    }

    @GetMapping("/{refundId}")
    public ApiResult<RefundOrder> getByRefundId(@PathVariable String refundId) {
        return ApiResult.success(refundService.getByRefundId(refundId));
    }

    @GetMapping("/order/{orderNo}")
    public ApiResult<List<RefundOrder>> getByOrderNo(@PathVariable String orderNo) {
        return ApiResult.success(refundService.getByOrderNo(orderNo));
    }
}
