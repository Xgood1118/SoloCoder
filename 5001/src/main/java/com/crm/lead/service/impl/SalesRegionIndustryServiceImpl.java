package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.entity.SalesRegionIndustry;
import com.crm.lead.mapper.SalesRegionIndustryMapper;
import com.crm.lead.service.SalesRegionIndustryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class SalesRegionIndustryServiceImpl extends ServiceImpl<SalesRegionIndustryMapper, SalesRegionIndustry> implements SalesRegionIndustryService {

    @Autowired
    private SalesRegionIndustryMapper regionIndustryMapper;

    @Override
    public List<SalesRegionIndustry> getBySalespersonId(Long salespersonId) {
        LambdaQueryWrapper<SalesRegionIndustry> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SalesRegionIndustry::getSalespersonId, salespersonId)
                .orderByAsc(SalesRegionIndustry::getPriority);
        return regionIndustryMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void saveBatch(Long salespersonId, List<SalesRegionIndustry> list) {
        regionIndustryMapper.delete(
                new LambdaQueryWrapper<SalesRegionIndustry>()
                        .eq(SalesRegionIndustry::getSalespersonId, salespersonId)
        );

        if (list != null && !list.isEmpty()) {
            for (SalesRegionIndustry item : list) {
                item.setSalespersonId(salespersonId);
                item.setCreatedTime(new Date());
                regionIndustryMapper.insert(item);
            }
        }
    }
}
