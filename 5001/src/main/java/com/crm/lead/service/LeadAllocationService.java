package com.crm.lead.service;

import com.crm.lead.dto.LeadAssignDTO;
import com.crm.lead.dto.LeadClaimDTO;
import com.crm.lead.entity.SalesLead;

public interface LeadAllocationService {

    SalesLead allocateLead(Long leadId);

    void batchAllocateLeads();

    SalesLead manualAssign(LeadAssignDTO dto);

    SalesLead claimLead(LeadClaimDTO dto);
}
