package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.dto.RefundRecordDTO;
import com.crm.lead.entity.RefundRecord;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.service.RefundRecordService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Api(tags = "退款记录管理")
@RestController
@RequestMapping("/refund")
public class RefundRecordController {

    @Autowired
    private RefundRecordService refundRecordService;

    @ApiOperation("分页查询退款记录")
    @GetMapping("/page")
    public Result<PageResult<RefundRecord>> queryPage(
            @RequestParam(required = false) Long leadId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<RefundRecord> page = refundRecordService.queryPage(leadId, customerId, pageNum, pageSize);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @ApiOperation("获取退款记录详情")
    @GetMapping("/{id}")
    public Result<RefundRecord> getDetail(@PathVariable Long id) {
        return Result.success(refundRecordService.getById(id));
    }

    @ApiOperation("创建退款记录（同时更新线索状态）")
    @PostMapping
    public Result<SalesLead> createRefund(@Validated @RequestBody RefundRecordDTO dto) {
        return Result.success(refundRecordService.createRefund(dto));
    }
}
