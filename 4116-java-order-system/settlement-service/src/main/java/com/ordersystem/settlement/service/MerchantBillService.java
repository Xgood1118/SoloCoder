package com.ordersystem.settlement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.repository.OrderRepository;
import com.ordersystem.payment.model.PaymentRecord;
import com.ordersystem.payment.service.PaymentQueryService;
import com.ordersystem.settlement.model.BillStatus;
import com.ordersystem.settlement.model.MerchantBill;
import com.ordersystem.settlement.repository.MerchantBillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MerchantBillService {

    private final MerchantBillRepository merchantBillRepository;
    private final OrderRepository orderRepository;
    private final PaymentQueryService paymentQueryService;

    @Transactional
    public MerchantBill generateBill(String merchantId, java.time.LocalDate start, java.time.LocalDate end) {
        LambdaQueryWrapper<Order> orderWrapper = new LambdaQueryWrapper<Order>()
                .eq(Order::getMerchantId, merchantId)
                .ge(Order::getCreatedAt, start.atStartOfDay())
                .lt(Order::getCreatedAt, end.plusDays(1).atStartOfDay());
        List<Order> orders = orderRepository.selectList(orderWrapper);

        BigDecimal orderAmount = orders.stream()
                .map(Order::getPayAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<PaymentRecord> refundRecords = paymentQueryService.queryRefundsByMerchantAndPeriod(merchantId, start, end);
        BigDecimal refundAmount = refundRecords.stream()
                .map(PaymentRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal commissionRate = new BigDecimal("0.05");
        BigDecimal commissionAmount = calculateCommission(orderAmount, commissionRate);
        BigDecimal settlementAmount = orderAmount.subtract(refundAmount).subtract(commissionAmount);

        MerchantBill bill = new MerchantBill();
        bill.setBillId(UUID.randomUUID().toString().replace("-", ""));
        bill.setMerchantId(merchantId);
        bill.setPeriodStart(start);
        bill.setPeriodEnd(end);
        bill.setOrderAmount(orderAmount);
        bill.setRefundAmount(refundAmount);
        bill.setCommissionRate(commissionRate);
        bill.setCommissionAmount(commissionAmount);
        bill.setSettlementAmount(settlementAmount);
        bill.setStatus(BillStatus.GENERATED);
        bill.setCreatedAt(LocalDateTime.now());

        merchantBillRepository.insert(bill);
        return bill;
    }

    @Transactional
    public MerchantBill confirmBill(String billId) {
        MerchantBill bill = merchantBillRepository.selectById(billId);
        bill.setStatus(BillStatus.MERCHANT_CONFIRMED);
        bill.setConfirmedAt(LocalDateTime.now());
        merchantBillRepository.updateById(bill);
        return bill;
    }

    public BigDecimal calculateCommission(BigDecimal orderAmount, BigDecimal rate) {
        return orderAmount.multiply(rate).setScale(2, RoundingMode.HALF_UP);
    }
}
