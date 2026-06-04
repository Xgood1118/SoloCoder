package com.crm.lead.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crm.lead.dto.CommunicationRecordDTO;
import com.crm.lead.entity.CommunicationRecord;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.enums.CommTypeEnum;
import com.crm.lead.exception.BusinessException;
import com.crm.lead.mapper.CommunicationRecordMapper;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.service.CommunicationRecordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class CommunicationRecordServiceImpl extends ServiceImpl<CommunicationRecordMapper, CommunicationRecord> implements CommunicationRecordService {

    @Autowired
    private SalesLeadMapper salesLeadMapper;

    @Override
    public IPage<CommunicationRecord> queryPage(Long leadId, Long customerId, Long salespersonId, Integer pageNum, Integer pageSize) {
        LambdaQueryWrapper<CommunicationRecord> wrapper = new LambdaQueryWrapper<>();
        if (leadId != null) {
            wrapper.eq(CommunicationRecord::getLeadId, leadId);
        }
        if (customerId != null) {
            wrapper.eq(CommunicationRecord::getCustomerId, customerId);
        }
        if (salespersonId != null) {
            wrapper.eq(CommunicationRecord::getSalespersonId, salespersonId);
        }
        wrapper.eq(CommunicationRecord::getIsDeleted, 0);
        wrapper.orderByDesc(CommunicationRecord::getCreatedTime);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CommunicationRecord create(CommunicationRecordDTO dto) {
        SalesLead lead = salesLeadMapper.selectById(dto.getLeadId());
        if (lead == null) {
            throw new BusinessException("线索不存在");
        }

        CommunicationRecord record = new CommunicationRecord();
        BeanUtil.copyProperties(dto, record);
        record.setCreatedTime(new Date());
        record.setUpdatedTime(new Date());
        record.setIsDeleted(0);

        if (CommTypeEnum.VOICE.name().equals(dto.getCommType())) {
            record.setTranscriptStatus(1);
        } else {
            record.setTranscriptStatus(0);
        }

        save(record);

        lead.setLastCommunicationTime(new Date());
        if (dto.getNextActionTime() != null) {
            lead.setNextFollowTime(dto.getNextActionTime());
        }
        lead.setUpdatedTime(new Date());

        if (lead.getFirstContactTime() == null) {
            lead.setFirstContactTime(new Date());
        }

        salesLeadMapper.updateById(lead);

        return record;
    }

    @Override
    public CommunicationRecord getById(Long id) {
        CommunicationRecord record = super.getById(id);
        if (record == null || record.getIsDeleted() == 1) {
            throw new BusinessException("沟通记录不存在");
        }
        return record;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        CommunicationRecord record = getById(id);
        record.setIsDeleted(1);
        record.setUpdatedTime(new Date());
        updateById(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateTranscript(Long id, String transcriptContent) {
        CommunicationRecord record = getById(id);
        record.setTranscriptContent(transcriptContent);
        record.setTranscriptStatus(2);
        record.setUpdatedTime(new Date());
        updateById(record);
    }

    @Override
    public List<CommunicationRecord> getByLeadId(Long leadId) {
        return list(new LambdaQueryWrapper<CommunicationRecord>()
                .eq(CommunicationRecord::getLeadId, leadId)
                .eq(CommunicationRecord::getIsDeleted, 0)
                .orderByDesc(CommunicationRecord::getCreatedTime));
    }
}
