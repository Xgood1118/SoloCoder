package com.ordersystem.settlement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ordersystem.domain.model.Order;
import com.ordersystem.domain.model.OrderStatus;
import com.ordersystem.domain.repository.OrderRepository;
import com.ordersystem.payment.model.PaymentChannel;
import com.ordersystem.payment.model.PaymentRecord;
import com.ordersystem.payment.service.PaymentQueryService;
import com.ordersystem.settlement.model.ReconcileDiffType;
import com.ordersystem.settlement.model.ReconcileStatus;
import com.ordersystem.settlement.model.ReconciliationDiffReport;
import com.ordersystem.settlement.model.ReconciliationRecord;
import com.ordersystem.settlement.model.ReportStatus;
import com.ordersystem.settlement.repository.ReconciliationDiffReportRepository;
import com.ordersystem.settlement.repository.ReconciliationRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReconciliationService {

    private final ReconciliationRecordRepository reconciliationRecordRepository;
    private final ReconciliationDiffReportRepository reconciliationDiffReportRepository;
    private final OrderRepository orderRepository;
    private final PaymentQueryService paymentQueryService;

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void reconcile() {
        reconcile(LocalDate.now());
    }

    @Transactional
    public void reconcile(LocalDate date) {
        LambdaQueryWrapper<Order> orderWrapper = new LambdaQueryWrapper<Order>()
                .eq(Order::getStatus, OrderStatus.PAID)
                .ge(Order::getCreatedAt, date.atStartOfDay())
                .lt(Order::getCreatedAt, date.plusDays(1).atStartOfDay());
        List<Order> systemOrders = orderRepository.selectList(orderWrapper);
        List<PaymentRecord> channelRecords = paymentQueryService.queryRecordsByDate(date);

        Map<String, Order> systemOrderMap = systemOrders.stream()
                .collect(Collectors.toMap(Order::getOrderNo, o -> o));
        Map<String, PaymentRecord> channelRecordMap = channelRecords.stream()
                .collect(Collectors.toMap(PaymentRecord::getOrderNo, r -> r));

        List<ReconciliationRecord> records = new ArrayList<>();
        List<String> matchedOrderNos = new ArrayList<>();

        for (Order order : systemOrders) {
            PaymentRecord channelRecord = channelRecordMap.get(order.getOrderNo());
            ReconciliationRecord record = new ReconciliationRecord();
            record.setOrderNo(order.getOrderNo());
            record.setChannel(PaymentChannel.ALIPAY);
            record.setSystemAmount(order.getPayAmount());
            record.setReconciledAt(LocalDateTime.now());
            record.setCreatedAt(LocalDateTime.now());

            if (channelRecord == null) {
                record.setChannelAmount(BigDecimal.ZERO);
                record.setDiffAmount(order.getPayAmount());
                record.setStatus(ReconcileStatus.CHANNEL_MISSING);
                record.setDiffType(ReconcileDiffType.CHANNEL_ONLY);
            } else {
                matchedOrderNos.add(order.getOrderNo());
                record.setChannelAmount(channelRecord.getAmount());
                BigDecimal diff = order.getPayAmount().subtract(channelRecord.getAmount());

                if (diff.compareTo(BigDecimal.ZERO) == 0) {
                    record.setDiffAmount(BigDecimal.ZERO);
                    record.setStatus(ReconcileStatus.MATCHED);
                    record.setDiffType(null);
                } else {
                    record.setDiffAmount(diff);
                    record.setStatus(ReconcileStatus.MISMATCH);
                    if (diff.abs().compareTo(order.getPayAmount()) < 0) {
                        record.setDiffType(ReconcileDiffType.PARTIAL_PAYMENT);
                    } else {
                        record.setDiffType(ReconcileDiffType.AMOUNT_MISMATCH);
                    }
                }
            }
            records.add(record);
        }

        for (PaymentRecord channelRecord : channelRecords) {
            if (!systemOrderMap.containsKey(channelRecord.getOrderNo())) {
                ReconciliationRecord record = new ReconciliationRecord();
                record.setOrderNo(channelRecord.getOrderNo());
                record.setChannel(channelRecord.getChannel());
                record.setSystemAmount(BigDecimal.ZERO);
                record.setChannelAmount(channelRecord.getAmount());
                record.setDiffAmount(channelRecord.getAmount());
                record.setStatus(ReconcileStatus.SYSTEM_MISSING);
                record.setDiffType(ReconcileDiffType.SYSTEM_ONLY);
                record.setReconciledAt(LocalDateTime.now());
                record.setCreatedAt(LocalDateTime.now());
                records.add(record);
            }
        }

        for (ReconciliationRecord record : records) {
            reconciliationRecordRepository.insert(record);
            if (record.getStatus() != ReconcileStatus.MATCHED) {
                autoFix(record);
            }
        }

        generateDiffReport(date);
    }

    @Transactional
    public void autoFix(ReconciliationRecord record) {
        if (record.getDiffType() == ReconcileDiffType.AMOUNT_MISMATCH
                && record.getDiffAmount().abs().compareTo(new BigDecimal("1.00")) <= 0) {
            record.setStatus(ReconcileStatus.MATCHED);
            record.setDiffType(null);
            record.setDiffAmount(BigDecimal.ZERO);
            reconciliationRecordRepository.updateById(record);
        }
    }

    @Transactional
    public ReconciliationDiffReport generateDiffReport(LocalDate date) {
        LambdaQueryWrapper<ReconciliationRecord> wrapper = new LambdaQueryWrapper<ReconciliationRecord>()
                .ge(ReconciliationRecord::getReconciledAt, date.atStartOfDay())
                .lt(ReconciliationRecord::getReconciledAt, date.plusDays(1).atStartOfDay());
        List<ReconciliationRecord> allRecords = reconciliationRecordRepository.selectList(wrapper);

        int totalRecords = allRecords.size();
        int matchedRecords = (int) allRecords.stream().filter(r -> r.getStatus() == ReconcileStatus.MATCHED).count();
        int mismatchRecords = (int) allRecords.stream().filter(r -> r.getStatus() == ReconcileStatus.MISMATCH).count();
        int systemMissingRecords = (int) allRecords.stream().filter(r -> r.getStatus() == ReconcileStatus.SYSTEM_MISSING).count();
        int channelMissingRecords = (int) allRecords.stream().filter(r -> r.getStatus() == ReconcileStatus.CHANNEL_MISSING).count();
        int autoFixed = (int) allRecords.stream().filter(r -> r.getStatus() == ReconcileStatus.MATCHED && r.getDiffAmount().compareTo(BigDecimal.ZERO) == 0).count();
        int manualPending = mismatchRecords + systemMissingRecords + channelMissingRecords;

        ReconciliationDiffReport report = new ReconciliationDiffReport();
        report.setReportDate(date);
        report.setTotalRecords(totalRecords);
        report.setMatchedRecords(matchedRecords);
        report.setMismatchRecords(mismatchRecords);
        report.setSystemMissingRecords(systemMissingRecords);
        report.setChannelMissingRecords(channelMissingRecords);
        report.setAutoFixed(autoFixed);
        report.setManualPending(manualPending);
        report.setStatus(manualPending > 0 ? ReportStatus.PENDING_MANUAL : ReportStatus.AUTO_FIXED);
        report.setCreatedAt(LocalDateTime.now());

        reconciliationDiffReportRepository.insert(report);
        return report;
    }
}
