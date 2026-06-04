package com.crm.lead.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.mapper.SalespersonMapper;
import com.crm.lead.service.LeadStatusHistoryService;
import com.crm.lead.service.PoolService;
import com.crm.lead.service.ReminderService;
import com.crm.lead.service.SystemConfigService;
import com.crm.lead.utils.WorkDayUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class PoolServiceImpl implements PoolService {

    @Autowired
    private SalesLeadMapper leadMapper;

    @Autowired
    private SalespersonMapper salespersonMapper;

    @Autowired
    private SystemConfigService systemConfigService;

    @Autowired
    private LeadStatusHistoryService statusHistoryService;

    @Autowired
    private ReminderService reminderService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void autoReturnToPool() {
        Integer noCommDays = systemConfigService.getConfigIntValue("lead.no_communication_days", 15);

        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(SalesLead::getLeadStatus,
                        LeadStatusEnum.ASSIGNED.name(),
                        LeadStatusEnum.FOLLOWING.name(),
                        LeadStatusEnum.PENDING_CONFIRM.name())
                .isNotNull(SalesLead::getLastCommunicationTime)
                .eq(SalesLead::getIsDeleted, 0);

        List<SalesLead> leads = leadMapper.selectList(wrapper);

        Date now = new Date();
        for (SalesLead lead : leads) {
            int workDays = WorkDayUtils.calculateWorkDays(lead.getLastCommunicationTime(), now);
            if (workDays > noCommDays) {
                returnLeadToPool(lead);
            }
        }
    }

    @Override
    public IPage<SalesLead> getPoolLeads(Integer pageNum, Integer pageSize) {
        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SalesLead::getLeadStatus, LeadStatusEnum.IN_POOL.name())
                .eq(SalesLead::getIsDeleted, 0)
                .orderByDesc(SalesLead::getPoolEnterTime);

        return leadMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead claimFromPool(Long leadId, Long salespersonId) {
        SalesLead lead = leadMapper.selectById(leadId);
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (!LeadStatusEnum.IN_POOL.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("只有公海池中的线索才能认领");
        }

        Salesperson salesperson = salespersonMapper.selectById(salespersonId);
        if (salesperson == null) {
            throw new BusinessException("销售人员不存在");
        }

        if (salesperson.getIsActive() == null || salesperson.getIsActive() != 1) {
            throw new BusinessException("销售人员已离职，无法认领");
        }

        if (salesperson.getIsEligible() == null || salesperson.getIsEligible() != 1) {
            throw new BusinessException("销售人员暂不具备认领资格");
        }

        if (salesperson.getCurrentLeadCount() >= salesperson.getMaxLoad()) {
            throw new BusinessException("您的负载已满，无法认领更多线索");
        }

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.ASSIGNED.name());
        lead.setSalespersonId(salesperson.getId());
        lead.setAssignTime(new Date());
        lead.setClaimTime(new Date());
        lead.setPoolEnterTime(null);
        lead.setUpdatedTime(new Date());
        leadMapper.updateById(lead);

        updateSalespersonLoad(salesperson, 1);

        statusHistoryService.saveStatusHistory(lead.getId(), oldStatus, LeadStatusEnum.ASSIGNED.name(),
                oldSalespersonId, salesperson.getId(), "从公海认领",
                "销售" + salesperson.getName() + "从公海池认领",
                salesperson.getId(), salesperson.getName());

        reminderService.sendReminder(salesperson.getId(), salesperson.getName(), "LEAD_ASSIGNED",
                lead.getId(), "线索认领成功",
                "您已成功从公海池认领线索：" + lead.getLeadNo());

        return lead;
    }

    @Transactional(rollbackFor = Exception.class)
    protected void returnLeadToPool(SalesLead lead) {
        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.IN_POOL.name());
        lead.setPoolEnterTime(new Date());
        lead.setUpdatedTime(new Date());
        leadMapper.updateById(lead);

        if (oldSalespersonId != null) {
            Salesperson salesperson = salespersonMapper.selectById(oldSalespersonId);
            if (salesperson != null) {
                updateSalespersonLoad(salesperson, -1);

                reminderService.sendReminder(salesperson.getId(), salesperson.getName(), "LEAD_RETURNED_TO_POOL",
                        lead.getId(), "线索被回收至公海池",
                        "线索" + lead.getLeadNo() + "因超过15工作日无沟通已被回收至公海池");
            }
        }

        statusHistoryService.saveStatusHistory(lead.getId(), oldStatus, LeadStatusEnum.IN_POOL.name(),
                oldSalespersonId, null, "自动回收至公海池",
                "超过15工作日无沟通，系统自动回收", null, null);
    }

    private void updateSalespersonLoad(Salesperson salesperson, int delta) {
        int newCount = Math.max(0, salesperson.getCurrentLeadCount() + delta);
        LambdaUpdateWrapper<Salesperson> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Salesperson::getId, salesperson.getId())
                .set(Salesperson::getCurrentLeadCount, newCount)
                .set(Salesperson::getUpdatedTime, new Date());

        if (newCount >= salesperson.getMaxLoad()) {
            wrapper.set(Salesperson::getIsEligible, 0);
        } else if (salesperson.getRecoverThreshold() != null && newCount <= salesperson.getRecoverThreshold()) {
            wrapper.set(Salesperson::getIsEligible, 1);
        }

        salespersonMapper.update(null, wrapper);
    }
}
