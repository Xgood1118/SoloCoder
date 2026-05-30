package com.ordersystem.payment.repository;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.payment.model.PaymentRecord;
import org.apache.ibatis.annotations.Mapper;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface PaymentRecordRepository extends BaseMapper<PaymentRecord> {

    default List<PaymentRecord> findByTransDate(LocalDate transDate) {
        return selectList(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getTransDate, transDate));
    }

    default List<PaymentRecord> findByMerchantIdAndTransDateBetween(String merchantId, LocalDate startDate, LocalDate endDate) {
        return selectList(new LambdaQueryWrapper<PaymentRecord>()
                .eq(PaymentRecord::getOrderNo, merchantId)
                .between(PaymentRecord::getTransDate, startDate, endDate));
    }
}
