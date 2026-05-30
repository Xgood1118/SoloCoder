package com.ordersystem.settlement.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.settlement.model.MerchantBill;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MerchantBillRepository extends BaseMapper<MerchantBill> {
}
