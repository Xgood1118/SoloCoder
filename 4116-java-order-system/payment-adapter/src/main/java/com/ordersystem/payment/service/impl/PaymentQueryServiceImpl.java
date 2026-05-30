package com.ordersystem.payment.service.impl;

import com.ordersystem.payment.model.PaymentRecord;
import com.ordersystem.payment.repository.PaymentRecordRepository;
import com.ordersystem.payment.service.PaymentQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentQueryServiceImpl implements PaymentQueryService {

    private final PaymentRecordRepository paymentRecordRepository;

    @Override
    public List<PaymentRecord> queryRecordsByDate(LocalDate date) {
        return paymentRecordRepository.findByTransDate(date);
    }

    @Override
    public List<PaymentRecord> queryRefundsByMerchantAndPeriod(String merchantId, LocalDate start, LocalDate end) {
        return paymentRecordRepository.findByMerchantIdAndTransDateBetween(merchantId, start, end);
    }
}
