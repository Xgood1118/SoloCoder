package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.entity.LeadSource;
import com.crm.lead.service.LeadSourceService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "线索来源管理")
@RestController
@RequestMapping("/lead-source")
public class LeadSourceController {

    @Autowired
    private LeadSourceService leadSourceService;

    @ApiOperation("分页查询线索来源列表")
    @GetMapping("/page")
    public Result<PageResult<LeadSource>> queryPage(
            @ApiParam("页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @ApiParam("每页条数") @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<LeadSource> page = leadSourceService.queryPage(pageNum, pageSize);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @ApiOperation("获取启用的线索来源列表")
    @GetMapping("/active")
    public Result<List<LeadSource>> getActiveList() {
        return Result.success(leadSourceService.getActiveList());
    }
}
