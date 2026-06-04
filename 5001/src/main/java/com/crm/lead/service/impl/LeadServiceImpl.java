package com.crm.lead.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.dto.*;
import com.crm.lead.entity.*;
import com.crm.lead.vo.LeadDetailVO;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.*;
import com.crm.lead.service.LeadService;
import com.crm.lead.service.LeadStatusHistoryService;
import com.crm.lead.service.CustomerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class LeadServiceImpl extends ServiceImpl<SalesLeadMapper, SalesLead> implements LeadService {

    @Autowired
    private LeadStatusHistoryService statusHistoryService;

    @Autowired
    private CustomerService customerService;

    @Autowired
    private CustomerMapper customerMapper;

    @Autowired
    private CommunicationRecordMapper communicationRecordMapper;

    @Autowired
    private LeadMergeRecordMapper leadMergeRecordMapper;

    @Autowired
    private LeadSourceMapper leadSourceMapper;

    @Autowired
    private SalespersonMapper salespersonMapper;

    @Autowired
    private SysDictMapper sysDictMapper;

    @Override
    public IPage<SalesLead> queryPage(LeadQueryDTO queryDTO) {
        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(queryDTO.getLeadNo())) {
            wrapper.like(SalesLead::getLeadNo, queryDTO.getLeadNo());
        }
        if (StrUtil.isNotBlank(queryDTO.getLeadStatus())) {
            wrapper.eq(SalesLead::getLeadStatus, queryDTO.getLeadStatus());
        }
        if (queryDTO.getImportanceLevel() != null) {
            wrapper.eq(SalesLead::getImportanceLevel, queryDTO.getImportanceLevel());
        }
        if (queryDTO.getSalespersonId() != null) {
            wrapper.eq(SalesLead::getSalespersonId, queryDTO.getSalespersonId());
        }
        if (queryDTO.getCustomerId() != null) {
            wrapper.eq(SalesLead::getCustomerId, queryDTO.getCustomerId());
        }
        if (queryDTO.getSourceId() != null) {
            wrapper.eq(SalesLead::getSourceId, queryDTO.getSourceId());
        }
        if (queryDTO.getCityId() != null) {
            wrapper.eq(SalesLead::getCityId, queryDTO.getCityId());
        }
        if (queryDTO.getStartTime() != null) {
            wrapper.ge(SalesLead::getCreatedTime, queryDTO.getStartTime());
        }
        if (queryDTO.getEndTime() != null) {
            wrapper.le(SalesLead::getCreatedTime, queryDTO.getEndTime());
        }
        wrapper.eq(SalesLead::getIsDeleted, 0);
        wrapper.orderByDesc(SalesLead::getCreatedTime);
        return page(new Page<>(queryDTO.getPageNum(), queryDTO.getPageSize()), wrapper);
    }

    @Override
    public LeadDetailVO getDetail(Long id) {
        SalesLead lead = getById(id);
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }
        LeadDetailVO vo = new LeadDetailVO();
        BeanUtil.copyProperties(lead, vo);

        Customer customer = customerMapper.selectById(lead.getCustomerId());
        if (customer != null) {
            vo.setCustomerName(customer.getCompanyName());
            vo.setCustomerType(customer.getCustomerType());
        }

        LeadSource source = leadSourceMapper.selectById(lead.getSourceId());
        if (source != null) {
            vo.setSourceName(source.getSourceName());
        }

        if (lead.getSalespersonId() != null) {
            Salesperson salesperson = salespersonMapper.selectById(lead.getSalespersonId());
            if (salesperson != null) {
                vo.setSalespersonName(salesperson.getName());
            }
        }

        if (lead.getProvinceId() != null) {
            SysDict province = sysDictMapper.selectOne(
                    new LambdaQueryWrapper<SysDict>()
                            .eq(SysDict::getDictType, "PROVINCE")
                            .eq(SysDict::getDictCode, String.valueOf(lead.getProvinceId()))
            );
            if (province != null) {
                vo.setProvinceName(province.getDictName());
            }
        }

        if (lead.getCityId() != null) {
            SysDict city = sysDictMapper.selectOne(
                    new LambdaQueryWrapper<SysDict>()
                            .eq(SysDict::getDictType, "CITY")
                            .eq(SysDict::getDictCode, String.valueOf(lead.getCityId()))
            );
            if (city != null) {
                vo.setCityName(city.getDictName());
            }
        }

        List<CommunicationRecord> records = communicationRecordMapper.selectList(
                new LambdaQueryWrapper<CommunicationRecord>()
                        .eq(CommunicationRecord::getLeadId, id)
                        .eq(CommunicationRecord::getIsDeleted, 0)
                        .orderByDesc(CommunicationRecord::getCreatedTime)
        );
        vo.setCommunicationRecords(records);

        List<LeadStatusHistory> histories = statusHistoryService.getByLeadId(id);
        vo.setStatusHistories(histories);

        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead createLead(LeadCreateDTO dto) {
        Long activeLeadCount = count(
                new LambdaQueryWrapper<SalesLead>()
                        .eq(SalesLead::getCustomerId, dto.getCustomerId())
                        .eq(SalesLead::getIsDeleted, 0)
                        .notIn(SalesLead::getLeadStatus, LeadStatusEnum.CLOSED.name(), LeadStatusEnum.DEALED.name())
        );

        if (activeLeadCount > 0) {
            throw new BusinessException("该客户下存在" + activeLeadCount + "条未关闭线索，请勿重复创建");
        }

        SalesLead lead = new SalesLead();
        BeanUtil.copyProperties(dto, lead);
        lead.setLeadNo(generateLeadNo());
        lead.setLeadStatus(LeadStatusEnum.PENDING_ASSIGN.name());
        lead.setPoolEnterTime(new Date());
        lead.setCreatedTime(new Date());
        lead.setUpdatedTime(new Date());
        lead.setIsDeleted(0);
        save(lead);

        statusHistoryService.saveStatusHistory(lead.getId(), null, LeadStatusEnum.PENDING_ASSIGN.name(),
                null, null, "创建线索", null, dto.getCreatedBy(), null);

        return lead;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead updateStatus(LeadStatusUpdateDTO dto) {
        SalesLead lead = getById(dto.getLeadId());
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(dto.getNewStatus());
        lead.setUpdatedTime(new Date());
        updateById(lead);

        statusHistoryService.saveStatusHistory(lead.getId(), oldStatus, dto.getNewStatus(),
                oldSalespersonId, oldSalespersonId, dto.getChangeReason(), dto.getRemark(),
                dto.getOperatorId(), dto.getOperatorName());

        return lead;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead dealLead(Long leadId, Long operatorId, String operatorName) {
        SalesLead lead = getById(leadId);
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (LeadStatusEnum.DEALED.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("该线索已成交，请勿重复操作");
        }

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        String customerNo = customerService.generateCustomerNo();

        Customer customer = customerMapper.selectById(lead.getCustomerId());
        if (customer != null) {
            customer.setCustomerNo(customerNo);
            customer.setCustomerStatus(2);
            customer.setUpdatedTime(new Date());
            customerMapper.updateById(customer);
        }

        lead.setLeadStatus(LeadStatusEnum.DEALED.name());
        lead.setDealTime(new Date());
        lead.setUpdatedTime(new Date());
        updateById(lead);

        if (oldSalespersonId != null) {
            Salesperson salesperson = salespersonMapper.selectById(oldSalespersonId);
            if (salesperson != null) {
                int newCount = Math.max(0, salesperson.getCurrentLeadCount() - 1);
                salesperson.setCurrentLeadCount(newCount);
                if (salesperson.getRecoverThreshold() != null && newCount <= salesperson.getRecoverThreshold()) {
                    salesperson.setIsEligible(1);
                }
                salesperson.setUpdatedTime(new Date());
                salespersonMapper.updateById(salesperson);
            }
        }

        statusHistoryService.saveStatusHistory(leadId, oldStatus, LeadStatusEnum.DEALED.name(),
                oldSalespersonId, oldSalespersonId, "线索成交", "客户编号：" + customerNo,
                operatorId, operatorName);

        return lead;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead closeLead(Long leadId, String closeReason, Long operatorId, String operatorName) {
        SalesLead lead = getById(leadId);
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (LeadStatusEnum.CLOSED.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("该线索已关闭，请勿重复操作");
        }

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.CLOSED.name());
        lead.setCloseReason(closeReason);
        lead.setCloseTime(new Date());
        lead.setUpdatedTime(new Date());
        updateById(lead);

        if (oldSalespersonId != null) {
            Salesperson salesperson = salespersonMapper.selectById(oldSalespersonId);
            if (salesperson != null) {
                int newCount = Math.max(0, salesperson.getCurrentLeadCount() - 1);
                salesperson.setCurrentLeadCount(newCount);
                if (salesperson.getRecoverThreshold() != null && newCount <= salesperson.getRecoverThreshold()) {
                    salesperson.setIsEligible(1);
                }
                salesperson.setUpdatedTime(new Date());
                salespersonMapper.updateById(salesperson);
            }
        }

        statusHistoryService.saveStatusHistory(leadId, oldStatus, LeadStatusEnum.CLOSED.name(),
                oldSalespersonId, oldSalespersonId, "关闭线索", closeReason,
                operatorId, operatorName);

        return lead;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead mergeLeads(LeadMergeDTO dto) {
        SalesLead mainLead = getById(dto.getMainLeadId());
        if (mainLead == null) {
            throw new BusinessException("主线索不存在");
        }

        for (Long mergedId : dto.getMergedLeadIds()) {
            if (mergedId.equals(dto.getMainLeadId())) {
                throw new BusinessException("主线索不能与自身合并");
            }

            SalesLead mergedLead = getById(mergedId);
            if (mergedLead == null) {
                throw new BusinessException("待合并线索不存在：" + mergedId);
            }

            if (!mergedLead.getCustomerId().equals(mainLead.getCustomerId())) {
                throw new BusinessException("线索所属客户不一致，无法合并");
            }

            String oldStatus = mergedLead.getLeadStatus();
            Long oldSalespersonId = mergedLead.getSalespersonId();

            mergedLead.setIsMerged(1);
            mergedLead.setMainLeadId(dto.getMainLeadId());
            mergedLead.setMergeTime(new Date());
            mergedLead.setLeadStatus(LeadStatusEnum.CLOSED.name());
            mergedLead.setCloseReason("已合并到线索：" + mainLead.getLeadNo());
            mergedLead.setCloseTime(new Date());
            mergedLead.setUpdatedTime(new Date());
            updateById(mergedLead);

            if (oldSalespersonId != null) {
                Salesperson salesperson = salespersonMapper.selectById(oldSalespersonId);
                if (salesperson != null) {
                    int newCount = Math.max(0, salesperson.getCurrentLeadCount() - 1);
                    salesperson.setCurrentLeadCount(newCount);
                    if (salesperson.getRecoverThreshold() != null && newCount <= salesperson.getRecoverThreshold()) {
                        salesperson.setIsEligible(1);
                    }
                    salesperson.setUpdatedTime(new Date());
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
            mergeRecord.setMergeTime(new Date());
            leadMergeRecordMapper.insert(mergeRecord);

            statusHistoryService.saveStatusHistory(mergedId, oldStatus, LeadStatusEnum.CLOSED.name(),
                    oldSalespersonId, oldSalespersonId, "线索合并",
                    "合并到线索：" + mainLead.getLeadNo() + "，原因：" + dto.getMergeReason(),
                    dto.getOperatorId(), dto.getOperatorName());
        }

        statusHistoryService.saveStatusHistory(dto.getMainLeadId(), mainLead.getLeadStatus(),
                mainLead.getLeadStatus(), mainLead.getSalespersonId(), mainLead.getSalespersonId(),
                "合并线索", "合并线索数量：" + dto.getMergedLeadIds().size() + "，原因：" + dto.getMergeReason(),
                dto.getOperatorId(), dto.getOperatorName());

        return mainLead;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void returnToPool(Long leadId, String reason) {
        SalesLead lead = getById(leadId);
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (LeadStatusEnum.IN_POOL.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("该线索已在公海池中");
        }

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.IN_POOL.name());
        lead.setSalespersonId(null);
        lead.setAssignTime(null);
        lead.setClaimTime(null);
        lead.setPoolEnterTime(new Date());
        lead.setUpdatedTime(new Date());
        updateById(lead);

        if (oldSalespersonId != null) {
            Salesperson salesperson = salespersonMapper.selectById(oldSalespersonId);
            if (salesperson != null) {
                int newCount = Math.max(0, salesperson.getCurrentLeadCount() - 1);
                salesperson.setCurrentLeadCount(newCount);
                if (salesperson.getRecoverThreshold() != null && newCount <= salesperson.getRecoverThreshold()) {
                    salesperson.setIsEligible(1);
                }
                salesperson.setUpdatedTime(new Date());
                salespersonMapper.updateById(salesperson);
            }
        }

        statusHistoryService.saveStatusHistory(leadId, oldStatus, LeadStatusEnum.IN_POOL.name(),
                oldSalespersonId, null, "退回公海池", reason, null, null);
    }

    private String generateLeadNo() {
        String prefix = "L" + DateUtil.format(new Date(), "yyyyMMdd");
        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        wrapper.likeRight(SalesLead::getLeadNo, prefix)
                .orderByDesc(SalesLead::getLeadNo)
                .last("LIMIT 1");
        SalesLead lastLead = getOne(wrapper);
        int sequence = 1;
        if (lastLead != null && StrUtil.isNotBlank(lastLead.getLeadNo())) {
            String num = lastLead.getLeadNo().substring(prefix.length());
            try {
                sequence = Integer.parseInt(num) + 1;
            } catch (NumberFormatException e) {
                sequence = 1;
            }
        }
        return prefix + String.format("%04d", sequence);
    }
}
