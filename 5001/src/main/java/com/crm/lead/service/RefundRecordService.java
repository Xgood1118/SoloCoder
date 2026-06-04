package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.dto.RefundRecordDTO;
import com.crm.lead.entity.RefundRecord;
import com.crm.lead.entity.SalesLead;

public interface RefundRecordService extends IService<RefundRecord> {

    IPage<RefundRecord> queryPage(Long leadId, Long customerId, Integer pageNum, Integer pageSize);

    SalesLead createRefund(RefundRecordDTO dto);

    RefundRecord getById(Long id);
}
