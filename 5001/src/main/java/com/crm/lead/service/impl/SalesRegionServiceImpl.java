package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.entity.SalesRegion;
import com.crm.lead.mapper.SalesRegionMapper;
import com.crm.lead.service.SalesRegionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SalesRegionServiceImpl extends ServiceImpl<SalesRegionMapper, SalesRegion> implements SalesRegionService {

    @Autowired
    private SalesRegionMapper salesRegionMapper;

    @Override
    public IPage<SalesRegion> queryPage(Integer regionLevel, Long parentId, Integer pageNum, Integer pageSize) {
        LambdaQueryWrapper<SalesRegion> wrapper = new LambdaQueryWrapper<>();
        if (regionLevel != null) {
            wrapper.eq(SalesRegion::getRegionLevel, regionLevel);
        }
        if (parentId != null) {
            wrapper.eq(SalesRegion::getParentId, parentId);
        }
        wrapper.eq(SalesRegion::getStatus, 1)
                .orderByAsc(SalesRegion::getSortOrder)
                .orderByAsc(SalesRegion::getId);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    public List<SalesRegion> getProvinceList() {
        LambdaQueryWrapper<SalesRegion> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SalesRegion::getRegionLevel, 1)
                .eq(SalesRegion::getStatus, 1)
                .orderByAsc(SalesRegion::getSortOrder)
                .orderByAsc(SalesRegion::getId);
        return salesRegionMapper.selectList(wrapper);
    }

    @Override
    public List<SalesRegion> getCityList(Long provinceId) {
        LambdaQueryWrapper<SalesRegion> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SalesRegion::getRegionLevel, 2)
                .eq(SalesRegion::getParentId, provinceId)
                .eq(SalesRegion::getStatus, 1)
                .orderByAsc(SalesRegion::getSortOrder)
                .orderByAsc(SalesRegion::getId);
        return salesRegionMapper.selectList(wrapper);
    }
}
