package com.ordersystem.settlement.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.settlement.model.SettlementOrder;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SettlementOrderRepository extends BaseMapper<SettlementOrder> {
}
