package com.crm.lead.vo;

import com.crm.lead.entity.Customer;
import com.crm.lead.entity.CustomerContact;
import com.crm.lead.entity.CustomerDecisionChain;
import com.crm.lead.entity.CustomerLicense;
import com.crm.lead.entity.SalesLead;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class CustomerDetailVO extends Customer {

    private List<CustomerContact> contacts;

    private List<CustomerLicense> licenses;

    private List<CustomerDecisionChain> decisionChains;

    private List<SalesLead> leads;
}
