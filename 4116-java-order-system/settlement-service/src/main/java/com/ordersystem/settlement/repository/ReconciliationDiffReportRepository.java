package com.ordersystem.settlement.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.settlement.model.ReconciliationDiffReport;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ReconciliationDiffReportRepository extends BaseMapper<ReconciliationDiffReport> {
}
