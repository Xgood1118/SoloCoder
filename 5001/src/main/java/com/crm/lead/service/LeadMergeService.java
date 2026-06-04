package com.crm.lead.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.dto.LeadMergeDTO;
import com.crm.lead.entity.LeadMergeRecord;
import com.crm.lead.entity.SalesLead;

import java.util.List;

public interface LeadMergeService extends IService<LeadMergeRecord> {

    SalesLead mergeLeads(LeadMergeDTO dto);

    List<LeadMergeRecord> getMergeHistory(Long leadId);
}
