package com.crm.lead.service.impl;

import cn.hutool.core.date.DateUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.crm.lead.dto.LeadAssignDTO;
import com.crm.lead.dto.LeadClaimDTO;
import com.crm.lead.engine.AllocationScore;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.SalesRegionIndustry;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.mapper.SalesRegionIndustryMapper;
import com.crm.lead.mapper.SalespersonMapper;
import com.crm.lead.service.LeadAllocationService;
import com.crm.lead.service.LeadStatusHistoryService;
import com.crm.lead.service.ReminderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LeadAllocationServiceImpl implements LeadAllocationService {

    @Autowired
    private SalesLeadMapper leadMapper;

    @Autowired
    private SalespersonMapper salespersonMapper;

    @Autowired
    private SalesRegionIndustryMapper regionIndustryMapper;

    @Autowired
    private LeadStatusHistoryService statusHistoryService;

    @Autowired
    private ReminderService reminderService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead allocateLead(Long leadId) {
        SalesLead lead = leadMapper.selectById(leadId);
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (!LeadStatusEnum.PENDING_ASSIGN.name().equals(lead.getLeadStatus())
                && !LeadStatusEnum.IN_POOL.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("线索状态不允许分配");
        }

        List<Salesperson> candidates = findEligibleSalespersons(lead.getCityId(), lead.getIndustryCode());
        if (candidates.isEmpty()) {
            throw new BusinessException("暂无符合条件的销售人员可分配");
        }

        Map<Long, List<SalesRegionIndustry>> salespersonRegions = getSalespersonRegions(candidates);
        Map<Long, Date> lastAssignTimeMap = getLastAssignTimeMap(candidates);

        List<AllocationScore> scores = AllocationScore.calculate(candidates, lead, salespersonRegions, lastAssignTimeMap);
        if (scores.isEmpty()) {
            throw new BusinessException("分配评分计算失败");
        }

        AllocationScore bestScore = scores.get(0);
        Salesperson selectedSalesperson = candidates.stream()
                .filter(s -> s.getId().equals(bestScore.getSalespersonId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("分配结果异常"));

        return doAllocate(lead, selectedSalesperson, "系统自动分配");
    }

    @Override
    @Async
    @Transactional(rollbackFor = Exception.class)
    public void batchAllocateLeads() {
        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(SalesLead::getLeadStatus, LeadStatusEnum.PENDING_ASSIGN.name(), LeadStatusEnum.IN_POOL.name())
                .eq(SalesLead::getIsDeleted, 0)
                .orderByDesc(SalesLead::getImportanceLevel)
                .orderByAsc(SalesLead::getCreatedTime);

        List<SalesLead> leads = leadMapper.selectList(wrapper);
        for (SalesLead lead : leads) {
            try {
                allocateLead(lead.getId());
            } catch (Exception e) {
                System.err.println("批量分配线索失败，线索ID：" + lead.getId() + "，原因：" + e.getMessage());
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead manualAssign(LeadAssignDTO dto) {
        SalesLead lead = leadMapper.selectById(dto.getLeadId());
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (!LeadStatusEnum.PENDING_ASSIGN.name().equals(lead.getLeadStatus())
                && !LeadStatusEnum.IN_POOL.name().equals(lead.getLeadStatus())
                && !LeadStatusEnum.ASSIGNED.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("线索状态不允许分配");
        }

        Salesperson salesperson = salespersonMapper.selectById(dto.getSalespersonId());
        if (salesperson == null) {
            throw new BusinessException("销售人员不存在");
        }

        if (salesperson.getIsActive() == null || salesperson.getIsActive() != 1) {
            throw new BusinessException("销售人员已离职，无法分配");
        }

        if (salesperson.getCurrentLeadCount() >= salesperson.getMaxLoad()) {
            throw new BusinessException("销售人员负载已满，无法分配");
        }

        return doAllocate(lead, salesperson, "手动分配");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead claimLead(LeadClaimDTO dto) {
        SalesLead lead = leadMapper.selectById(dto.getLeadId());
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (!LeadStatusEnum.IN_POOL.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("只有公海池中的线索才能认领");
        }

        Salesperson salesperson = salespersonMapper.selectById(dto.getSalespersonId());
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

        boolean isQualified = checkSalespersonQualified(salesperson.getId(), lead.getCityId(), lead.getIndustryCode());
        if (!isQualified) {
            throw new BusinessException("您不具备该区域或行业的销售资格");
        }

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.ASSIGNED.name());
        lead.setSalespersonId(salesperson.getId());
        lead.setAssignTime(new Date());
        lead.setClaimTime(new Date());
        lead.setFirstContactDeadline(DateUtil.offsetDay(new Date(), 3));
        lead.setPoolEnterTime(null);
        lead.setUpdatedTime(new Date());
        leadMapper.updateById(lead);

        updateSalespersonLoad(salesperson, 1);

        statusHistoryService.saveStatusHistory(lead.getId(), oldStatus, LeadStatusEnum.ASSIGNED.name(),
                oldSalespersonId, salesperson.getId(), "销售认领",
                "销售" + salesperson.getName() + "主动认领",
                salesperson.getId(), salesperson.getName());

        reminderService.sendReminder(salesperson.getId(), salesperson.getName(), "LEAD_ASSIGNED",
                lead.getId(), "线索认领成功",
                "您已成功认领线索：" + lead.getLeadNo() + "，请在3天内完成首次联系");

        return lead;
    }

    private List<Salesperson> findEligibleSalespersons(Long cityId, String industryCode) {
        List<SalesRegionIndustry> regions = regionIndustryMapper.selectList(
                new LambdaQueryWrapper<SalesRegionIndustry>()
                        .eq(SalesRegionIndustry::getRegionId, cityId)
                        .eq(SalesRegionIndustry::getIndustryCode, industryCode)
        );

        if (regions.isEmpty()) {
            return List.of();
        }

        List<Long> salespersonIds = regions.stream()
                .map(SalesRegionIndustry::getSalespersonId)
                .distinct()
                .collect(Collectors.toList());

        return salespersonMapper.selectList(
                new LambdaQueryWrapper<Salesperson>()
                        .in(Salesperson::getId, salespersonIds)
                        .eq(Salesperson::getIsActive, 1)
                        .eq(Salesperson::getIsEligible, 1)
                        .apply("current_lead_count < max_load")
        );
    }

    private boolean checkSalespersonQualified(Long salespersonId, Long cityId, String industryCode) {
        Long count = regionIndustryMapper.selectCount(
                new LambdaQueryWrapper<SalesRegionIndustry>()
                        .eq(SalesRegionIndustry::getSalespersonId, salespersonId)
                        .eq(SalesRegionIndustry::getRegionId, cityId)
                        .eq(SalesRegionIndustry::getIndustryCode, industryCode)
        );
        return count != null && count > 0;
    }

    private Map<Long, List<SalesRegionIndustry>> getSalespersonRegions(List<Salesperson> salespersons) {
        List<Long> salespersonIds = salespersons.stream()
                .map(Salesperson::getId)
                .collect(Collectors.toList());

        List<SalesRegionIndustry> regions = regionIndustryMapper.selectList(
                new LambdaQueryWrapper<SalesRegionIndustry>()
                        .in(SalesRegionIndustry::getSalespersonId, salespersonIds)
        );

        return regions.stream()
                .collect(Collectors.groupingBy(SalesRegionIndustry::getSalespersonId));
    }

    private Map<Long, Date> getLastAssignTimeMap(List<Salesperson> salespersons) {
        List<Long> salespersonIds = salespersons.stream()
                .map(Salesperson::getId)
                .collect(Collectors.toList());

        Map<Long, Date> result = new java.util.HashMap<>();
        for (Long salespersonId : salespersonIds) {
            SalesLead lastLead = leadMapper.selectOne(
                    new LambdaQueryWrapper<SalesLead>()
                            .eq(SalesLead::getSalespersonId, salespersonId)
                            .isNotNull(SalesLead::getAssignTime)
                            .orderByDesc(SalesLead::getAssignTime)
                            .last("LIMIT 1")
            );
            if (lastLead != null && lastLead.getAssignTime() != null) {
                result.put(salespersonId, lastLead.getAssignTime());
            }
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    protected SalesLead doAllocate(SalesLead lead, Salesperson salesperson, String changeReason) {
        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.ASSIGNED.name());
        lead.setSalespersonId(salesperson.getId());
        lead.setAssignTime(new Date());
        lead.setPoolEnterTime(null);
        lead.setUpdatedTime(new Date());
        leadMapper.updateById(lead);

        updateSalespersonLoad(salesperson, 1);

        statusHistoryService.saveStatusHistory(lead.getId(), oldStatus, LeadStatusEnum.ASSIGNED.name(),
                oldSalespersonId, salesperson.getId(), changeReason, null, null, null);

        reminderService.sendReminder(salesperson.getId(), salesperson.getName(), "LEAD_ASSIGNED",
                lead.getId(), "新线索分配通知",
                "您有一条新线索待处理，线索编号：" + lead.getLeadNo());

        return lead;
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
