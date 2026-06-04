package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.service.PoolService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@Api(tags = "公海池管理")
@RestController
@RequestMapping("/pool")
public class PoolController {

    @Autowired
    private PoolService poolService;

    @ApiOperation("获取公海池中的线索")
    @GetMapping("/leads")
    public Result<PageResult<SalesLead>> getPoolLeads(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<SalesLead> page = poolService.getPoolLeads(pageNum, pageSize);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @ApiOperation("从公海池认领线索")
    @PostMapping("/claim/{leadId}")
    public Result<SalesLead> claimFromPool(@PathVariable Long leadId,
                                           @RequestParam Long salespersonId) {
        return Result.success(poolService.claimFromPool(leadId, salespersonId));
    }

    @ApiOperation("手动执行公海回收（仅管理员）")
    @PostMapping("/auto-return")
    public Result<Void> autoReturnToPool() {
        poolService.autoReturnToPool();
        return Result.success();
    }
}
