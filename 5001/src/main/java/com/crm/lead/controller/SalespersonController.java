package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.vo.SalespersonVO;
import com.crm.lead.entity.Salesperson;
import com.crm.lead.service.SalespersonService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "销售人员管理")
@RestController
@RequestMapping("/salesperson")
public class SalespersonController {

    @Autowired
    private SalespersonService salespersonService;

    @ApiOperation("分页查询销售人员列表")
    @GetMapping("/page")
    public Result<PageResult<Salesperson>> queryPage(
            @ApiParam("关键词（姓名/工号/手机号/部门）") @RequestParam(required = false) String keyword,
            @ApiParam("页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @ApiParam("每页条数") @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<Salesperson> page = salespersonService.queryPage(keyword, pageNum, pageSize);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @ApiOperation("获取销售人员详情")
    @GetMapping("/{id}")
    public Result<SalespersonVO> getDetail(@ApiParam("销售人员ID") @PathVariable Long id) {
        return Result.success(salespersonService.getDetail(id));
    }

    @ApiOperation("新增销售人员")
    @PostMapping
    public Result<Salesperson> create(@RequestBody Salesperson salesperson) {
        return Result.success(salespersonService.create(salesperson));
    }

    @ApiOperation("修改销售人员")
    @PutMapping
    public Result<Salesperson> update(@RequestBody Salesperson salesperson) {
        return Result.success(salespersonService.update(salesperson));
    }

    @ApiOperation("删除销售人员")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@ApiParam("销售人员ID") @PathVariable Long id) {
        salespersonService.delete(id);
        return Result.success();
    }

    @ApiOperation("更新销售人员当前线索数量")
    @PostMapping("/update-lead-count/{id}")
    public Result<Void> updateCurrentLeadCount(@ApiParam("销售人员ID") @PathVariable Long id) {
        salespersonService.updateCurrentLeadCount(id);
        return Result.success();
    }

    @ApiOperation("检查销售人员负载是否可用")
    @GetMapping("/load-available/{id}")
    public Result<Boolean> isLoadAvailable(@ApiParam("销售人员ID") @PathVariable Long id) {
        return Result.success(salespersonService.isLoadAvailable(id));
    }

    @ApiOperation("获取符合分配条件的销售人员列表")
    @GetMapping("/eligible")
    public Result<List<SalespersonVO>> getEligibleSalespersons(
            @ApiParam("城市ID") @RequestParam(required = false) Long cityId,
            @ApiParam("行业编码") @RequestParam(required = false) String industryCode,
            @ApiParam("重要级别") @RequestParam(required = false) Integer importanceLevel) {
        return Result.success(salespersonService.getEligibleSalespersons(cityId, industryCode, importanceLevel));
    }
}
