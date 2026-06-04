package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.entity.LeadSource;

import java.util.List;

public interface LeadSourceService extends IService<LeadSource> {

    IPage<LeadSource> queryPage(Integer pageNum, Integer pageSize);

    List<LeadSource> getActiveList();
}
