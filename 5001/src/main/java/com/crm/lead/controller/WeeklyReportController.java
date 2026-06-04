package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.dto.WeeklyReportQueryDTO;
import com.crm.lead.entity.SalesWeeklyReport;
import com.crm.lead.service.WeeklyReportService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@Api(tags = "销售周报管理")
@RestController
@RequestMapping("/weekly-report")
public class WeeklyReportController {

    @Autowired
    private WeeklyReportService weeklyReportService;

    @ApiOperation("分页查询周报")
    @GetMapping("/page")
    public Result<PageResult<SalesWeeklyReport>> queryPage(WeeklyReportQueryDTO queryDTO) {
        IPage<SalesWeeklyReport> page = weeklyReportService.queryPage(queryDTO);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(),
                queryDTO.getPageNum(), queryDTO.getPageSize()));
    }

    @ApiOperation("获取周报详情")
    @GetMapping("/{id}")
    public Result<SalesWeeklyReport> getDetail(@PathVariable Long id) {
        return Result.success(weeklyReportService.getDetail(id));
    }

    @ApiOperation("手动生成上周周报（仅管理员）")
    @PostMapping("/generate")
    public Result<Void> generateWeeklyReports() {
        weeklyReportService.generateWeeklyReports();
        return Result.success();
    }
}
