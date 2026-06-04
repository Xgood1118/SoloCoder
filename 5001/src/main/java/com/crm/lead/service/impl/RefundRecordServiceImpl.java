package com.crm.lead.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.dto.RefundRecordDTO;
import com.crm.lead.entity.Customer;
import com.crm.lead.entity.RefundRecord;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.CustomerMapper;
import com.crm.lead.mapper.RefundRecordMapper;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.service.LeadStatusHistoryService;
import com.crm.lead.service.RefundRecordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

@Service
public class RefundRecordServiceImpl extends ServiceImpl<RefundRecordMapper, RefundRecord> implements RefundRecordService {

    @Autowired
    private SalesLeadMapper salesLeadMapper;

    @Autowired
    private CustomerMapper customerMapper;

    @Autowired
    private LeadStatusHistoryService statusHistoryService;

    @Override
    public IPage<RefundRecord> queryPage(Long leadId, Long customerId, Integer pageNum, Integer pageSize) {
        LambdaQueryWrapper<RefundRecord> wrapper = new LambdaQueryWrapper<>();
        if (leadId != null) {
            wrapper.eq(RefundRecord::getLeadId, leadId);
        }
        if (customerId != null) {
            wrapper.eq(RefundRecord::getCustomerId, customerId);
        }
        wrapper.orderByDesc(RefundRecord::getCreatedTime);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SalesLead createRefund(RefundRecordDTO dto) {
        SalesLead lead = salesLeadMapper.selectById(dto.getLeadId());
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        if (!LeadStatusEnum.DEALED.name().equals(lead.getLeadStatus())) {
            throw new BusinessException("只有已成交的线索才能办理退款");
        }

        Customer customer = customerMapper.selectById(dto.getCustomerId());
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }

        RefundRecord refundRecord = new RefundRecord();
        BeanUtil.copyProperties(dto, refundRecord);
        refundRecord.setCreatedTime(new Date());
        save(refundRecord);

        String oldStatus = lead.getLeadStatus();
        Long oldSalespersonId = lead.getSalespersonId();

        lead.setLeadStatus(LeadStatusEnum.FOLLOWING.name());
        lead.setUpdatedTime(new Date());
        salesLeadMapper.updateById(lead);

        statusHistoryService.saveStatusHistory(lead.getId(), oldStatus, LeadStatusEnum.FOLLOWING.name(),
                oldSalespersonId, oldSalespersonId, "退款退货",
                "退款金额：" + dto.getRefundAmount() + "，原因：" + dto.getRefundReason(),
                dto.getOperatorId(), dto.getOperatorName());

        customer.setCustomerStatus(1);
        customer.setUpdatedTime(new Date());
        customerMapper.updateById(customer);

        return lead;
    }

    @Override
    public RefundRecord getById(Long id) {
        RefundRecord record = super.getById(id);
        if (record == null) {
            throw new BusinessException("退款记录不存在");
        }
        return record;
    }
}
