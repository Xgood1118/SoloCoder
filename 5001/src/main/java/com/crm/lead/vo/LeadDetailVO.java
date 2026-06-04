package com.crm.lead.vo;

import com.crm.lead.entity.CommunicationRecord;
import com.crm.lead.entity.LeadStatusHistory;
import com.crm.lead.entity.SalesLead;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class LeadDetailVO extends SalesLead {

    private String customerName;

    private Integer customerType;

    private String sourceName;

    private String salespersonName;

    private String provinceName;

    private String cityName;

    private List<CommunicationRecord> communicationRecords;

    private List<LeadStatusHistory> statusHistories;
}
