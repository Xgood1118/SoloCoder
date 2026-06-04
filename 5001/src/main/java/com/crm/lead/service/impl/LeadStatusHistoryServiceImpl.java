package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.entity.LeadStatusHistory;
import com.crm.lead.mapper.LeadStatusHistoryMapper;
import com.crm.lead.service.LeadStatusHistoryService;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
public class LeadStatusHistoryServiceImpl extends ServiceImpl<LeadStatusHistoryMapper, LeadStatusHistory>
        implements LeadStatusHistoryService {

    @Override
    public void saveStatusHistory(Long leadId, String oldStatus, String newStatus,
                                  Long oldSalespersonId, Long newSalespersonId,
                                  String changeReason, String remark,
                                  Long operatorId, String operatorName) {
        LeadStatusHistory history = new LeadStatusHistory();
        history.setLeadId(leadId);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setOldSalespersonId(oldSalespersonId);
        history.setNewSalespersonId(newSalespersonId);
        history.setChangeReason(changeReason);
        history.setRemark(remark);
        history.setOperatorId(operatorId);
        history.setOperatorName(operatorName);
        history.setOperateTime(new Date());
        save(history);
    }

    @Override
    public List<LeadStatusHistory> getByLeadId(Long leadId) {
        return list(new LambdaQueryWrapper<LeadStatusHistory>()
                .eq(LeadStatusHistory::getLeadId, leadId)
                .orderByDesc(LeadStatusHistory::getOperateTime));
    }
}
