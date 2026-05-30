package com.ordersystem.settlement.service;

import com.ordersystem.settlement.model.BillStatus;
import com.ordersystem.settlement.model.MerchantBill;
import com.ordersystem.settlement.model.SettlementOrder;
import com.ordersystem.settlement.model.SettlementStatus;
import com.ordersystem.settlement.repository.MerchantBillRepository;
import com.ordersystem.settlement.repository.SettlementOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private final SettlementOrderRepository settlementOrderRepository;
    private final MerchantBillRepository merchantBillRepository;

    @Transactional
    public SettlementOrder createSettlement(String billId) {
        MerchantBill bill = merchantBillRepository.selectById(billId);
        SettlementOrder order = new SettlementOrder();
        order.setSettlementId(UUID.randomUUID().toString().replace("-", ""));
        order.setMerchantId(bill.getMerchantId());
        order.setBillId(billId);
        order.setAmount(bill.getSettlementAmount());
        order.setStatus(SettlementStatus.PENDING_APPROVAL);
        order.setCreatedAt(LocalDateTime.now());

        settlementOrderRepository.insert(order);
        return order;
    }

    @Transactional
    public SettlementOrder approveSettlement(String settlementId, String operator) {
        SettlementOrder order = settlementOrderRepository.selectById(settlementId);
        order.setStatus(SettlementStatus.APPROVED);
        order.setOperator(operator);
        order.setOperatedAt(LocalDateTime.now());
        settlementOrderRepository.updateById(order);

        MerchantBill bill = merchantBillRepository.selectById(order.getBillId());
        bill.setStatus(BillStatus.APPROVED);
        merchantBillRepository.updateById(bill);

        return order;
    }

    @Transactional
    public SettlementOrder executeSettlement(String settlementId) {
        SettlementOrder order = settlementOrderRepository.selectById(settlementId);

        try {
            order.setStatus(SettlementStatus.PAID);
            order.setOperatedAt(LocalDateTime.now());
            settlementOrderRepository.updateById(order);

            MerchantBill bill = merchantBillRepository.selectById(order.getBillId());
            bill.setStatus(BillStatus.PAID);
            merchantBillRepository.updateById(bill);
        } catch (Exception e) {
            order.setStatus(SettlementStatus.FAILED);
            order.setOperatedAt(LocalDateTime.now());
            settlementOrderRepository.updateById(order);
        }

        return order;
    }
}
