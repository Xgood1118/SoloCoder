package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.entity.SalesLead;

import java.util.List;

public interface PoolService {

    void autoReturnToPool();

    IPage<SalesLead> getPoolLeads(Integer pageNum, Integer pageSize);

    SalesLead claimFromPool(Long leadId, Long salespersonId);
}
