package com.crm.lead.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.entity.LeadStatusHistory;

import java.util.List;

public interface LeadStatusHistoryService extends IService<LeadStatusHistory> {

    void saveStatusHistory(Long leadId, String oldStatus, String newStatus,
                           Long oldSalespersonId, Long newSalespersonId,
                           String changeReason, String remark,
                           Long operatorId, String operatorName);

    List<LeadStatusHistory> getByLeadId(Long leadId);
}
