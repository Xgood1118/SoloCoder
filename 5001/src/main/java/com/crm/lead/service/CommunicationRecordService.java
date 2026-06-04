package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.crm.lead.dto.CommunicationRecordDTO;
import com.crm.lead.entity.CommunicationRecord;

import java.util.List;

public interface CommunicationRecordService extends IService<CommunicationRecord> {

    IPage<CommunicationRecord> queryPage(Long leadId, Long customerId, Long salespersonId, Integer pageNum, Integer pageSize);

    CommunicationRecord create(CommunicationRecordDTO dto);

    CommunicationRecord getById(Long id);

    void delete(Long id);

    void updateTranscript(Long id, String transcriptContent);

    List<CommunicationRecord> getByLeadId(Long leadId);
}
