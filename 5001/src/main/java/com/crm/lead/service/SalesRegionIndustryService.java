package com.crm.lead.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.entity.SalesRegionIndustry;

import java.util.List;

public interface SalesRegionIndustryService extends IService<SalesRegionIndustry> {

    List<SalesRegionIndustry> getBySalespersonId(Long salespersonId);

    void saveBatch(Long salespersonId, List<SalesRegionIndustry> list);
}
