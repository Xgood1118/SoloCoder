package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.vo.SalespersonVO;
import com.crm.lead.entity.Salesperson;

import java.util.List;

public interface SalespersonService extends IService<Salesperson> {

    IPage<Salesperson> queryPage(String keyword, Integer pageNum, Integer pageSize);

    SalespersonVO getDetail(Long id);

    Salesperson create(Salesperson salesperson);

    Salesperson update(Salesperson salesperson);

    void delete(Long id);

    void updateCurrentLeadCount(Long salespersonId);

    boolean isLoadAvailable(Long salespersonId);

    List<SalespersonVO> getEligibleSalespersons(Long cityId, String industryCode, Integer importanceLevel);
}
