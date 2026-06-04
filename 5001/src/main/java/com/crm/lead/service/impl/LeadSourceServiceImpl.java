package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.entity.LeadSource;
import com.crm.lead.mapper.LeadSourceMapper;
import com.crm.lead.service.LeadSourceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LeadSourceServiceImpl extends ServiceImpl<LeadSourceMapper, LeadSource> implements LeadSourceService {

    @Autowired
    private LeadSourceMapper leadSourceMapper;

    @Override
    public IPage<LeadSource> queryPage(Integer pageNum, Integer pageSize) {
        LambdaQueryWrapper<LeadSource> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(LeadSource::getCreatedTime);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    public List<LeadSource> getActiveList() {
        LambdaQueryWrapper<LeadSource> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(LeadSource::getIsActive, 1)
                .orderByAsc(LeadSource::getDefaultImportance)
                .orderByDesc(LeadSource::getCreatedTime);
        return leadSourceMapper.selectList(wrapper);
    }
}
