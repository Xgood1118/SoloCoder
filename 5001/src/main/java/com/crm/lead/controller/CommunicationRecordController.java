package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.dto.CommunicationRecordDTO;
import com.crm.lead.entity.CommunicationRecord;
import com.crm.lead.service.CommunicationRecordService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "沟通记录管理")
@RestController
@RequestMapping("/communication-record")
public class CommunicationRecordController {

    @Autowired
    private CommunicationRecordService communicationRecordService;

    @ApiOperation("分页查询沟通记录")
    @GetMapping("/page")
    public Result<PageResult<CommunicationRecord>> queryPage(
            @RequestParam(required = false) Long leadId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long salespersonId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<CommunicationRecord> page = communicationRecordService.queryPage(
                leadId, customerId, salespersonId, pageNum, pageSize);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @ApiOperation("获取沟通记录详情")
    @GetMapping("/{id}")
    public Result<CommunicationRecord> getDetail(@PathVariable Long id) {
        return Result.success(communicationRecordService.getById(id));
    }

    @ApiOperation("新增沟通记录")
    @PostMapping
    public Result<CommunicationRecord> create(@Validated @RequestBody CommunicationRecordDTO dto) {
        return Result.success(communicationRecordService.create(dto));
    }

    @ApiOperation("删除沟通记录")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        communicationRecordService.delete(id);
        return Result.success();
    }

    @ApiOperation("更新语音转写内容")
    @PutMapping("/transcript/{id}")
    public Result<Void> updateTranscript(@PathVariable Long id,
                                         @RequestBody String transcriptContent) {
        communicationRecordService.updateTranscript(id, transcriptContent);
        return Result.success();
    }

    @ApiOperation("根据线索ID查询沟通记录列表")
    @GetMapping("/lead/{leadId}")
    public Result<List<CommunicationRecord>> getByLeadId(@PathVariable Long leadId) {
        return Result.success(communicationRecordService.getByLeadId(leadId));
    }
}
