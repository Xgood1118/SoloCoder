package com.ai.training.controller;

import com.ai.training.common.Result;
import com.ai.training.dto.ApprovalDTO;
import com.ai.training.entity.ApprovalConfig;
import com.ai.training.entity.ApprovalFlow;
import com.ai.training.enums.ModelType;
import com.ai.training.service.ApprovalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {

    @Autowired
    private ApprovalService approvalService;

    @PostMapping("/submit")
    public Result<ApprovalFlow> submitApproval(@Valid @RequestBody ApprovalDTO dto) {
        return Result.success(approvalService.submitApproval(dto));
    }

    @PostMapping("/{id}/approve")
    public Result<ApprovalFlow> approve(@PathVariable Long id,
                                        @RequestParam String approver,
                                        @RequestParam(required = false) String comment) {
        return Result.success(approvalService.approve(id, approver, comment));
    }

    @PostMapping("/{id}/reject")
    public Result<ApprovalFlow> reject(@PathVariable Long id,
                                       @RequestParam String approver,
                                       @RequestParam(required = false) String comment) {
        return Result.success(approvalService.reject(id, approver, comment));
    }

    @GetMapping("/{id}")
    public Result<ApprovalFlow> getApprovalFlow(@PathVariable Long id) {
        return Result.success(approvalService.getApprovalFlow(id));
    }

    @GetMapping("/task/{taskId}")
    public Result<List<ApprovalFlow>> getApprovalsByTaskId(@PathVariable Long taskId) {
        return Result.success(approvalService.getApprovalsByTaskId(taskId));
    }

    @GetMapping("/pending")
    public Result<List<ApprovalFlow>> getPendingApprovals() {
        return Result.success(approvalService.getPendingApprovals());
    }

    @PostMapping("/config")
    public Result<ApprovalConfig> setApprovalConfig(@RequestParam ModelType modelType,
                                                    @RequestParam String approvers,
                                                    @RequestParam String createdBy) {
        return Result.success(approvalService.setApprovalConfig(modelType, approvers, createdBy));
    }

    @GetMapping("/config/{modelType}")
    public Result<ApprovalConfig> getApprovalConfig(@PathVariable ModelType modelType) {
        return Result.success(approvalService.getApprovalConfig(modelType));
    }

    @GetMapping("/config")
    public Result<List<ApprovalConfig>> getAllApprovalConfigs() {
        return Result.success(approvalService.getAllApprovalConfigs());
    }
}
