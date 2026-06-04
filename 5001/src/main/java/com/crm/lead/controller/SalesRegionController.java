package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.entity.SalesRegion;
import com.crm.lead.service.SalesRegionService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "销售区域管理")
@RestController
@RequestMapping("/sales-region")
public class SalesRegionController {

    @Autowired
    private SalesRegionService salesRegionService;

    @ApiOperation("分页查询销售区域列表")
    @GetMapping("/page")
    public Result<PageResult<SalesRegion>> queryPage(
            @ApiParam("区域级别（1-省份，2-城市）") @RequestParam(required = false) Integer regionLevel,
            @ApiParam("父级ID") @RequestParam(required = false) Long parentId,
            @ApiParam("页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @ApiParam("每页条数") @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<SalesRegion> page = salesRegionService.queryPage(regionLevel, parentId, pageNum, pageSize);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @ApiOperation("获取省份列表")
    @GetMapping("/province")
    public Result<List<SalesRegion>> getProvinceList() {
        return Result.success(salesRegionService.getProvinceList());
    }

    @ApiOperation("根据省份ID获取城市列表")
    @GetMapping("/city")
    public Result<List<SalesRegion>> getCityList(
            @ApiParam("省份ID") @RequestParam Long provinceId) {
        return Result.success(salesRegionService.getCityList(provinceId));
    }
}
