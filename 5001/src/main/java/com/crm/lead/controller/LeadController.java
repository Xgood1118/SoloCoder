package com.crm.lead.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.crm.lead.common.PageResult;
import com.crm.lead.common.Result;
import com.crm.lead.dto.*;
import com.crm.lead.entity.LeadStatusHistory;
import com.crm.lead.vo.LeadDetailVO;
import com.crm.lead.entity.ReminderMessage;
import com.crm.lead.entity.SalesLead;
import com.crm.lead.service.LeadAllocationService;
import com.crm.lead.service.LeadService;
import com.crm.lead.service.LeadStatusHistoryService;
import com.crm.lead.service.ReminderService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "销售线索管理")
@RestController
@RequestMapping("/lead")
public class LeadController {

    @Autowired
    private LeadService leadService;

    @Autowired
    private LeadAllocationService allocationService;

    @Autowired
    private LeadStatusHistoryService statusHistoryService;

    @Autowired
    private ReminderService reminderService;

    @ApiOperation("分页查询线索列表")
    @GetMapping("/page")
    public Result<PageResult<SalesLead>> queryPage(LeadQueryDTO queryDTO) {
        IPage<SalesLead> page = leadService.queryPage(queryDTO);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(),
                queryDTO.getPageNum(), queryDTO.getPageSize()));
    }

    @ApiOperation("获取线索详情")
    @GetMapping("/{id}")
    public Result<LeadDetailVO> getDetail(@PathVariable Long id) {
        return Result.success(leadService.getDetail(id));
    }

    @ApiOperation("创建线索")
    @PostMapping
    public Result<SalesLead> createLead(@Validated @RequestBody LeadCreateDTO dto) {
        return Result.success(leadService.createLead(dto));
    }

    @ApiOperation("更新线索状态")
    @PutMapping("/status")
    public Result<SalesLead> updateStatus(@Validated @RequestBody LeadStatusUpdateDTO dto) {
        return Result.success(leadService.updateStatus(dto));
    }

    @ApiOperation("自动分配线索")
    @PostMapping("/allocate/{leadId}")
    public Result<SalesLead> allocateLead(@PathVariable Long leadId) {
        return Result.success(allocationService.allocateLead(leadId));
    }

    @ApiOperation("批量分配待分配线索")
    @PostMapping("/batch-allocate")
    public Result<Void> batchAllocateLeads() {
        allocationService.batchAllocateLeads();
        return Result.success();
    }

    @ApiOperation("手动分配线索")
    @PostMapping("/manual-assign")
    public Result<SalesLead> manualAssign(@Validated @RequestBody LeadAssignDTO dto) {
        return Result.success(allocationService.manualAssign(dto));
    }

    @ApiOperation("销售认领线索")
    @PostMapping("/claim")
    public Result<SalesLead> claimLead(@Validated @RequestBody LeadClaimDTO dto) {
        return Result.success(allocationService.claimLead(dto));
    }

    @ApiOperation("线索成交处理")
    @PostMapping("/deal/{leadId}")
    public Result<SalesLead> dealLead(@PathVariable Long leadId,
                                      @RequestParam Long operatorId,
                                      @RequestParam String operatorName) {
        return Result.success(leadService.dealLead(leadId, operatorId, operatorName));
    }

    @ApiOperation("关闭线索")
    @PostMapping("/close/{leadId}")
    public Result<SalesLead> closeLead(@PathVariable Long leadId,
                                       @RequestParam String closeReason,
                                       @RequestParam Long operatorId,
                                       @RequestParam String operatorName) {
        return Result.success(leadService.closeLead(leadId, closeReason, operatorId, operatorName));
    }

    @ApiOperation("合并线索")
    @PostMapping("/merge")
    public Result<SalesLead> mergeLeads(@Validated @RequestBody LeadMergeDTO dto) {
        return Result.success(leadService.mergeLeads(dto));
    }

    @ApiOperation("线索退回公海池")
    @PostMapping("/return-pool/{leadId}")
    public Result<Void> returnToPool(@PathVariable Long leadId,
                                     @RequestParam String reason) {
        leadService.returnToPool(leadId, reason);
        return Result.success();
    }

    @ApiOperation("查询线索状态历史")
    @GetMapping("/history/{leadId}")
    public Result<List<LeadStatusHistory>> getStatusHistory(@PathVariable Long leadId) {
        return Result.success(statusHistoryService.getByLeadId(leadId));
    }

    @ApiOperation("查询未读提醒消息")
    @GetMapping("/reminders/unread/{recipientId}")
    public Result<List<ReminderMessage>> getUnreadMessages(@PathVariable Long recipientId) {
        return Result.success(reminderService.getUnreadMessages(recipientId));
    }

    @ApiOperation("标记提醒消息已读")
    @PutMapping("/reminders/read/{id}")
    public Result<Void> markReminderAsRead(@PathVariable Long id) {
        reminderService.markAsRead(id);
        return Result.success();
    }

    @ApiOperation("发送提醒消息")
    @PostMapping("/reminders/send")
    public Result<Void> sendReminder(@RequestParam Long recipientId,
                                     @RequestParam String recipientName,
                                     @RequestParam String reminderType,
                                     @RequestParam(required = false) Long leadId,
                                     @RequestParam String title,
                                     @RequestParam String content) {
        reminderService.sendReminder(recipientId, recipientName, reminderType, leadId, title, content);
        return Result.success();
    }
}
