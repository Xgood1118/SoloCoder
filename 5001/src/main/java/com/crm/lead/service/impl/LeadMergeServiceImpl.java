package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.dto.LeadMergeDTO;
import com.crm.lead.entity.CommunicationRecord;
import com.crm.lead.entity.LeadMergeRecord;
import com.crm.lead.entity.LeadStatusHistory;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.CommunicationRecordMapper;
import com.crm.lead.mapper.LeadMergeRecordMapper;
import com.crm.lead.mapper.LeadStatusHistoryMapper;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.mapper.SalespersonMapper;
import com.crm.lead.service.LeadMergeService;
import com.crm.lead.service.LeadStatusHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class LeadMergeServiceImpl extends ServiceImpl<LeadMergeRecordMapper, LeadMergeRecord> implements LeadMergeService {

    @Autowired
    private SalesLeadMapper salesLeadMapper;

    @Autowired
    private CommunicationRecordMapper communicationRecordMapper;

    @Autowired
    private LeadStatusHistoryMapper leadStatusHistoryMapper;

    @Autowired
    private SalespersonMapper salespersonMapper;

    @Autowired
    private LeadStatusHistoryService statusHistoryService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead mergeLeads(LeadMergeDTO dto) {
        SalesLead mainLead = salesLeadMapper.selectById(dto.getMainLeadId());
        if (mainLead == null) {
            throw new BusinessException("主线索不存在");
        }

        for (Long mergedId : dto.getMergedLeadIds()) {
            if (mergedId.equals(dto.getMainLeadId())) {
                throw new BusinessException("主线索不能与自身合并");
            }

            SalesLead mergedLead = salesLeadMapper.selectById(mergedId);
            if (mergedLead == null) {
                throw new BusinessException("待合并线索不存在：" + mergedId);
            }

            if (!mergedLead.getCustomerId().equals(mainLead.getCustomerId())) {
                throw new BusinessException("线索所属客户不一致，无法合并");
            }

            if (LeadStatusEnum.DEALED.name().equals(mergedLead.getLeadStatus())
                    || LeadStatusEnum.CLOSED.name().equals(mergedLead.getLeadStatus())) {
                throw new BusinessException("已成交或已关闭的线索无法合并：" + mergedId);
            }
        }

        Date now = new Date();
        for (Long mergedId : dto.getMergedLeadIds()) {
            SalesLead mergedLead = salesLeadMapper.selectById(mergedId);
            String oldStatus = mergedLead.getLeadStatus();
            Long oldSalespersonId = mergedLead.getSalespersonId();

            mergedLead.setIsMerged(1);
            mergedLead.setMainLeadId(dto.getMainLeadId());
            mergedLead.setMergeTime(now);
            mergedLead.setUpdatedTime(now);
            salesLeadMapper.updateById(mergedLead);

            communicationRecordMapper.update(null,
                    new LambdaUpdateWrapper<CommunicationRecord>()
                            .eq(CommunicationRecord::getLeadId, mergedId)
                            .set(CommunicationRecord::getLeadId, dto.getMainLeadId())
                            .set(CommunicationRecord::getUpdatedTime, now));

            leadStatusHistoryMapper.update(null,
                    new LambdaUpdateWrapper<LeadStatusHistory>()
                            .eq(LeadStatusHistory::getLeadId, mergedId)
                            .set(LeadStatusHistory::getLeadId, dto.getMainLeadId()));

            if (oldSalespersonId != null) {
                Salesperson salesperson = salespersonMapper.selectById(oldSalespersonId);
                if (salesperson != null) {
                    int newCount = Math.max(0, salesperson.getCurrentLeadCount() - 1);
                    salesperson.setCurrentLeadCount(newCount);
                    if (salesperson.getRecoverThreshold() != null && newCount <= salesperson.getRecoverThreshold()) {
                        salesperson.setIsEligible(1);
                    }
                    salesperson.setUpdatedTime(now);
                    salespersonMapper.updateById(salesperson);
                }
            }

            LeadMergeRecord mergeRecord = new LeadMergeRecord();
            mergeRecord.setMainLeadId(dto.getMainLeadId());
            mergeRecord.setMergedLeadId(mergedId);
            mergeRecord.setCustomerId(mainLead.getCustomerId());
            mergeRecord.setMergeReason(dto.getMergeReason());
            mergeRecord.setOperatorId(dto.getOperatorId());
            mergeRecord.setOperatorName(dto.getOperatorName());
            mergeRecord.setMergeTime(now);
            save(mergeRecord);

            statusHistoryService.saveStatusHistory(mergedId, oldStatus, oldStatus,
                    oldSalespersonId, oldSalespersonId, "线索合并",
                    "合并到线索：" + mainLead.getLeadNo() + "，原因：" + dto.getMergeReason(),
                    dto.getOperatorId(), dto.getOperatorName());
        }

        mainLead.setUpdatedTime(now);
        salesLeadMapper.updateById(mainLead);

        statusHistoryService.saveStatusHistory(dto.getMainLeadId(), mainLead.getLeadStatus(),
                mainLead.getLeadStatus(), mainLead.getSalespersonId(), mainLead.getSalespersonId(),
                "合并线索", "合并线索数量：" + dto.getMergedLeadIds().size() + "，原因：" + dto.getMergeReason(),
                dto.getOperatorId(), dto.getOperatorName());

        return mainLead;
    }

    @Override
    public List<LeadMergeRecord> getMergeHistory(Long leadId) {
        return list(new LambdaQueryWrapper<LeadMergeRecord>()
                .eq(LeadMergeRecord::getMainLeadId, leadId)
                .orderByDesc(LeadMergeRecord::getMergeTime));
    }
}
