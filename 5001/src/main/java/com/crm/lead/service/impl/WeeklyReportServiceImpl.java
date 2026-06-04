package com.crm.lead.service.impl;

import cn.hutool.core.date.DateUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crm.lead.dto.WeeklyReportQueryDTO;
import com.crm.lead.entity.CommunicationRecord;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.entity.SalesWeeklyReport;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.enums.LeadStatusEnum;
import com.crm.lead.mapper.CommunicationRecordMapper;
import com.crm.lead.mapper.SalesLeadMapper;
import com.crm.lead.mapper.SalesWeeklyReportMapper;
import com.crm.lead.mapper.SalespersonMapper;
import com.crm.lead.service.WeeklyReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WeeklyReportServiceImpl implements WeeklyReportService {

    @Autowired
    private SalesWeeklyReportMapper reportMapper;

    @Autowired
    private SalesLeadMapper leadMapper;

    @Autowired
    private SalespersonMapper salespersonMapper;

    @Autowired
    private CommunicationRecordMapper communicationRecordMapper;

    @Override
    @Scheduled(cron = "0 0 2 ? * MON")
    @Transactional(rollbackFor = Exception.class)
    public void generateWeeklyReports() {
        Date[] weekRange = getLastWeekRange();
        Date weekStart = weekRange[0];
        Date weekEnd = weekRange[1];

        List<Salesperson> salespersons = salespersonMapper.selectList(
                new LambdaQueryWrapper<Salesperson>()
                        .eq(Salesperson::getIsActive, 1)
        );

        for (Salesperson salesperson : salespersons) {
            SalesWeeklyReport report = generateReportForSalesperson(salesperson, weekStart, weekEnd);
            reportMapper.insert(report);
        }
    }

    @Override
    public IPage<SalesWeeklyReport> queryPage(WeeklyReportQueryDTO queryDTO) {
        LambdaQueryWrapper<SalesWeeklyReport> wrapper = new LambdaQueryWrapper<>();

        if (queryDTO.getSalespersonId() != null) {
            wrapper.eq(SalesWeeklyReport::getSalespersonId, queryDTO.getSalespersonId());
        }
        if (queryDTO.getWeekStartDate() != null) {
            wrapper.ge(SalesWeeklyReport::getWeekStartDate, queryDTO.getWeekStartDate());
        }
        if (queryDTO.getWeekEndDate() != null) {
            wrapper.le(SalesWeeklyReport::getWeekEndDate, queryDTO.getWeekEndDate());
        }

        wrapper.orderByDesc(SalesWeeklyReport::getCreatedTime);

        return reportMapper.selectPage(
                new Page<>(queryDTO.getPageNum(), queryDTO.getPageSize()),
                wrapper
        );
    }

    @Override
    public SalesWeeklyReport getDetail(Long id) {
        return reportMapper.selectById(id);
    }

    private SalesWeeklyReport generateReportForSalesperson(Salesperson salesperson, Date weekStart, Date weekEnd) {
        SalesWeeklyReport report = new SalesWeeklyReport();
        report.setReportNo(generateReportNo(salesperson.getId(), weekStart));
        report.setSalespersonId(salesperson.getId());
        report.setSalespersonName(salesperson.getName());
        report.setWeekStartDate(weekStart);
        report.setWeekEndDate(weekEnd);
        report.setCreatedTime(new Date());

        List<SalesLead> weekLeads = getLeadsForSalespersonInWeek(salesperson.getId(), weekStart, weekEnd);
        List<CommunicationRecord> weekRecords = getCommunicationRecordsForSalespersonInWeek(salesperson.getId(), weekStart, weekEnd);

        report.setNewLeadCount(countNewLeads(weekLeads, weekStart, weekEnd));
        report.setFollowedLeadCount(countFollowedLeads(weekLeads, weekRecords));
        report.setDealedLeadCount(countDealedLeads(weekLeads, weekStart, weekEnd));
        report.setClosedLeadCount(countClosedLeads(weekLeads, weekStart, weekEnd));
        report.setPoolLeadCount(countPoolLeads(weekLeads, weekStart, weekEnd));
        report.setTotalDealAmount(sumDealAmount(weekLeads, weekStart, weekEnd));
        report.setUnclosedLeadCount(countLongTermUnclosedLeads(salesperson.getId(), weekEnd));
        report.setUnclosedReasonAnalysis(analyzeUnclosedReasons(weekLeads, weekRecords));
        report.setImprovementMeasures(generateImprovementMeasures(report));

        return report;
    }

    private Date[] getLastWeekRange() {
        Calendar cal = Calendar.getInstance();
        cal.setFirstDayOfWeek(Calendar.MONDAY);
        cal.setTime(new Date());

        cal.add(Calendar.WEEK_OF_YEAR, -1);
        cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        Date weekStart = cal.getTime();

        cal.add(Calendar.DAY_OF_MONTH, 6);
        cal.set(Calendar.HOUR_OF_DAY, 23);
        cal.set(Calendar.MINUTE, 59);
        cal.set(Calendar.SECOND, 59);
        cal.set(Calendar.MILLISECOND, 999);
        Date weekEnd = cal.getTime();

        return new Date[]{weekStart, weekEnd};
    }

    private String generateReportNo(Long salespersonId, Date weekStart) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd");
        return "WR" + sdf.format(weekStart) + String.format("%04d", salespersonId);
    }

    private List<SalesLead> getLeadsForSalespersonInWeek(Long salespersonId, Date weekStart, Date weekEnd) {
        return leadMapper.selectList(
                new LambdaQueryWrapper<SalesLead>()
                        .eq(SalesLead::getSalespersonId, salespersonId)
                        .eq(SalesLead::getIsDeleted, 0)
        );
    }

    private List<CommunicationRecord> getCommunicationRecordsForSalespersonInWeek(Long salespersonId, Date weekStart, Date weekEnd) {
        return communicationRecordMapper.selectList(
                new LambdaQueryWrapper<CommunicationRecord>()
                        .eq(CommunicationRecord::getSalespersonId, salespersonId)
                        .ge(CommunicationRecord::getCreatedTime, weekStart)
                        .le(CommunicationRecord::getCreatedTime, weekEnd)
                        .eq(CommunicationRecord::getIsDeleted, 0)
        );
    }

    private Integer countNewLeads(List<SalesLead> leads, Date weekStart, Date weekEnd) {
        return (int) leads.stream()
                .filter(lead -> lead.getCreatedTime() != null
                        && lead.getCreatedTime().after(weekStart)
                        && lead.getCreatedTime().before(weekEnd))
                .count();
    }

    private Integer countFollowedLeads(List<SalesLead> leads, List<CommunicationRecord> records) {
        Set<Long> followedLeadIds = records.stream()
                .map(CommunicationRecord::getLeadId)
                .collect(Collectors.toSet());
        return (int) leads.stream()
                .filter(lead -> followedLeadIds.contains(lead.getId()))
                .count();
    }

    private Integer countDealedLeads(List<SalesLead> leads, Date weekStart, Date weekEnd) {
        return (int) leads.stream()
                .filter(lead -> LeadStatusEnum.DEALED.name().equals(lead.getLeadStatus())
                        && lead.getDealTime() != null
                        && lead.getDealTime().after(weekStart)
                        && lead.getDealTime().before(weekEnd))
                .count();
    }

    private Integer countClosedLeads(List<SalesLead> leads, Date weekStart, Date weekEnd) {
        return (int) leads.stream()
                .filter(lead -> LeadStatusEnum.CLOSED.name().equals(lead.getLeadStatus())
                        && lead.getCloseTime() != null
                        && lead.getCloseTime().after(weekStart)
                        && lead.getCloseTime().before(weekEnd))
                .count();
    }

    private Integer countPoolLeads(List<SalesLead> leads, Date weekStart, Date weekEnd) {
        return (int) leads.stream()
                .filter(lead -> LeadStatusEnum.IN_POOL.name().equals(lead.getLeadStatus())
                        && lead.getPoolEnterTime() != null
                        && lead.getPoolEnterTime().after(weekStart)
                        && lead.getPoolEnterTime().before(weekEnd))
                .count();
    }

    private BigDecimal sumDealAmount(List<SalesLead> leads, Date weekStart, Date weekEnd) {
        return leads.stream()
                .filter(lead -> LeadStatusEnum.DEALED.name().equals(lead.getLeadStatus())
                        && lead.getDealTime() != null
                        && lead.getDealTime().after(weekStart)
                        && lead.getDealTime().before(weekEnd)
                        && lead.getExpectedAmount() != null)
                .map(SalesLead::getExpectedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Integer countLongTermUnclosedLeads(Long salespersonId, Date weekEnd) {
        Date thirtyDaysAgo = DateUtil.offsetDay(weekEnd, -30);
        LambdaQueryWrapper<SalesLead> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SalesLead::getSalespersonId, salespersonId)
                .notIn(SalesLead::getLeadStatus, LeadStatusEnum.DEALED.name(), LeadStatusEnum.CLOSED.name(), LeadStatusEnum.IN_POOL.name())
                .le(SalesLead::getCreatedTime, thirtyDaysAgo)
                .eq(SalesLead::getIsDeleted, 0);
        return Math.toIntExact(leadMapper.selectCount(wrapper));
    }

    private String analyzeUnclosedReasons(List<SalesLead> leads, List<CommunicationRecord> records) {
        List<SalesLead> unclosedLeads = leads.stream()
                .filter(lead -> !LeadStatusEnum.DEALED.name().equals(lead.getLeadStatus())
                        && !LeadStatusEnum.CLOSED.name().equals(lead.getLeadStatus()))
                .collect(Collectors.toList());

        Map<String, Long> statusGroup = unclosedLeads.stream()
                .collect(Collectors.groupingBy(SalesLead::getLeadStatus, Collectors.counting()));

        StringBuilder analysis = new StringBuilder();
        analysis.append("未成交线索状态分布：");
        for (Map.Entry<String, Long> entry : statusGroup.entrySet()) {
            analysis.append(entry.getKey()).append("：").append(entry.getValue()).append("条，");
        }

        List<String> keywords = extractKeywordsFromRecords(records);
        if (!keywords.isEmpty()) {
            analysis.append("沟通关键词：").append(String.join("、", keywords));
        }

        return analysis.toString();
    }

    private List<String> extractKeywordsFromRecords(List<CommunicationRecord> records) {
        List<String> keywords = new ArrayList<>();
        String[] targetKeywords = {"价格高", "预算不足", "需求不明确", "决策周期长", "竞争对手", "暂时不需要", "考虑考虑", "再联系"};

        for (CommunicationRecord record : records) {
            String content = record.getContent() != null ? record.getContent() : "";
            String transcript = record.getTranscriptContent() != null ? record.getTranscriptContent() : "";
            String combined = content + transcript;

            for (String keyword : targetKeywords) {
                if (combined.contains(keyword) && !keywords.contains(keyword)) {
                    keywords.add(keyword);
                }
            }
        }

        return keywords;
    }

    private String generateImprovementMeasures(SalesWeeklyReport report) {
        List<String> measures = new ArrayList<>();

        if (report.getNewLeadCount() == null || report.getNewLeadCount() < 3) {
            measures.add("新增线索较少，建议扩大获客渠道，增加市场推广投入");
        }

        if (report.getPoolLeadCount() != null && report.getPoolLeadCount() > 0) {
            measures.add("有线索流入公海池，建议加强线索跟进频率，避免资源流失");
        }

        if (report.getUnclosedLeadCount() != null && report.getUnclosedLeadCount() > 5) {
            measures.add("长期未成交线索较多，建议对存量线索进行复盘，优化跟进策略");
        }

        if (report.getDealedLeadCount() == null || report.getDealedLeadCount() == 0) {
            measures.add("本周无成交，建议重点推进高意向客户，加快转化周期");
        }

        String analysis = report.getUnclosedReasonAnalysis();
        if (analysis != null) {
            if (analysis.contains("价格高")) {
                measures.add("客户对价格敏感，建议准备更多价格方案和增值服务");
            }
            if (analysis.contains("需求不明确")) {
                measures.add("客户需求不明确，建议加强需求挖掘和引导，提供专业解决方案");
            }
            if (analysis.contains("决策周期长")) {
                measures.add("客户决策周期长，建议建立定期跟进机制，持续维护客户关系");
            }
        }

        if (measures.isEmpty()) {
            measures.add("本周表现良好，建议继续保持现有工作节奏，持续提升转化效率");
        }

        return String.join("；", measures);
    }
}
