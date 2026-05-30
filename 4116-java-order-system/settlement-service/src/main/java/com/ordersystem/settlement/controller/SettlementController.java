package com.ordersystem.settlement.controller;

import com.ordersystem.settlement.model.MerchantBill;
import com.ordersystem.settlement.model.ReconciliationDiffReport;
import com.ordersystem.settlement.model.SettlementOrder;
import com.ordersystem.settlement.service.MerchantBillService;
import com.ordersystem.settlement.service.ReconciliationService;
import com.ordersystem.settlement.service.SettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/settlement")
@RequiredArgsConstructor
public class SettlementController {

    private final ReconciliationService reconciliationService;
    private final MerchantBillService merchantBillService;
    private final SettlementService settlementService;

    @PostMapping("/reconcile")
    public void reconcile(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        reconciliationService.reconcile(date);
    }

    @GetMapping("/reconciliation/report/{date}")
    public ReconciliationDiffReport getReconciliationReport(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return reconciliationService.generateDiffReport(date);
    }

    @PostMapping("/bill/generate")
    public MerchantBill generateBill(@RequestParam String merchantId,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return merchantBillService.generateBill(merchantId, start, end);
    }

    @PostMapping("/bill/{billId}/confirm")
    public MerchantBill confirmBill(@PathVariable String billId) {
        return merchantBillService.confirmBill(billId);
    }

    @PostMapping("/settlement/create")
    public SettlementOrder createSettlement(@RequestParam String billId) {
        return settlementService.createSettlement(billId);
    }

    @PostMapping("/settlement/{settlementId}/approve")
    public SettlementOrder approveSettlement(@PathVariable String settlementId,
                                             @RequestParam String operator) {
        return settlementService.approveSettlement(settlementId, operator);
    }

    @PostMapping("/settlement/{settlementId}/execute")
    public SettlementOrder executeSettlement(@PathVariable String settlementId) {
        return settlementService.executeSettlement(settlementId);
    }
}
