package com.crm.lead.vo;

import com.crm.lead.entity.SalesRegionIndustry;
import com.crm.lead.entity.Salesperson;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class SalespersonVO extends Salesperson {

    private List<SalesRegionIndustry> regionIndustries;

    private BigDecimal currentLoadRate;
}
