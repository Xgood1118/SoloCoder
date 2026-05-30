package com.ordersystem.payment.service;

import com.ordersystem.payment.model.PaymentRecord;

import java.time.LocalDate;
import java.util.List;

public interface PaymentQueryService {

    List<PaymentRecord> queryRecordsByDate(LocalDate date);

    List<PaymentRecord> queryRefundsByMerchantAndPeriod(String merchantId, LocalDate start, LocalDate end);
}
