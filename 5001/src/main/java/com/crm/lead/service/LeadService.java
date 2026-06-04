package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.dto.*;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.vo.LeadDetailVO;

public interface LeadService extends IService<SalesLead> {

    IPage<SalesLead> queryPage(LeadQueryDTO queryDTO);

    LeadDetailVO getDetail(Long id);

    SalesLead createLead(LeadCreateDTO dto);

    SalesLead updateStatus(LeadStatusUpdateDTO dto);

    SalesLead dealLead(Long leadId, Long operatorId, String operatorName);

    SalesLead closeLead(Long leadId, String closeReason, Long operatorId, String operatorName);

    SalesLead mergeLeads(LeadMergeDTO dto);

    void returnToPool(Long leadId, String reason);
}
