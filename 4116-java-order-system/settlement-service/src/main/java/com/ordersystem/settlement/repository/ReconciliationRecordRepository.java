package com.ordersystem.settlement.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.settlement.model.ReconciliationRecord;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ReconciliationRecordRepository extends BaseMapper<ReconciliationRecord> {
}
