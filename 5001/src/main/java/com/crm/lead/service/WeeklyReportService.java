package com.crm.lead.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.dto.WeeklyReportQueryDTO;
import com.crm.lead.entity.SalesWeeklyReport;

public interface WeeklyReportService {

    void generateWeeklyReports();

    IPage<SalesWeeklyReport> queryPage(WeeklyReportQueryDTO queryDTO);

    SalesWeeklyReport getDetail(Long id);
}
