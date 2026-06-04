package com.crm.lead.controller;

import com.crm.lead.common.Result;
import com.crm.lead.entity.ReminderMessage;
import com.crm.lead.service.ReminderService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "系统提醒管理")
@RestController
@RequestMapping("/reminder")
public class ReminderController {

    @Autowired
    private ReminderService reminderService;

    @ApiOperation("获取未读消息")
    @GetMapping("/unread/{recipientId}")
    public Result<List<ReminderMessage>> getUnreadMessages(@PathVariable Long recipientId) {
        return Result.success(reminderService.getUnreadMessages(recipientId));
    }

    @ApiOperation("标记消息已读")
    @PutMapping("/read/{id}")
    public Result<Void> markAsRead(@PathVariable Long id) {
        reminderService.markAsRead(id);
        return Result.success();
    }

    @ApiOperation("批量标记已读")
    @PutMapping("/read-batch")
    public Result<Void> markBatchAsRead(@RequestBody List<Long> ids) {
        for (Long id : ids) {
            reminderService.markAsRead(id);
        }
        return Result.success();
    }
}
