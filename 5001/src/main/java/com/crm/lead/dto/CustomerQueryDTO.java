package com.crm.lead.dto;

import com.crm.lead.common.PageQuery;
import lombok.Data;

@Data
public class CustomerQueryDTO extends PageQuery {

    private String companyName;

    private Integer customerType;

    private String industryCode;

    private Long cityId;

    private Integer customerStatus;
}
