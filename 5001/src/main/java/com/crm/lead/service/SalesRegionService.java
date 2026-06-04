package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.entity.SalesRegion;

import java.util.List;

public interface SalesRegionService extends IService<SalesRegion> {

    IPage<SalesRegion> queryPage(Integer regionLevel, Long parentId, Integer pageNum, Integer pageSize);

    List<SalesRegion> getProvinceList();

    List<SalesRegion> getCityList(Long provinceId);
}
