package com.bpm.engine.api.controller;

import com.bpm.engine.api.dto.*;
import com.bpm.engine.api.dto.TaskQuery;
import com.bpm.engine.common.model.PageRequest;
import com.bpm.engine.task.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bpm/task")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping("/{taskId}")
    public R<?> getTask(@PathVariable String taskId) {
        return R.success(taskService.getTask(taskId));
    }

    @PostMapping("/{taskId}/claim")
    public R<Void> claimTask(@PathVariable String taskId, @RequestParam String userId) {
        taskService.claimTask(taskId, userId);
        return R.ok();
    }

    @PostMapping("/{taskId}/complete")
    public R<Void> completeTask(@PathVariable String taskId, @RequestBody CompleteTaskRequest request) {
        taskService.completeTask(taskId, request.getUserId(), request.getOutcome(),
                request.getComment(), request.getVariables());
        return R.ok();
    }

    @PostMapping("/{taskId}/reject")
    public R<Void> rejectTask(@PathVariable String taskId,
                              @RequestParam String userId,
                              @RequestParam String reason) {
        taskService.rejectTask(taskId, userId, reason);
        return R.ok();
    }

    @PostMapping("/{taskId}/delegate")
    public R<Void> delegateTask(@PathVariable String taskId, @RequestBody DelegateTaskRequest request) {
        taskService.delegateTask(taskId, request.getDelegateUserId());
        return R.ok();
    }

    @PostMapping("/{taskId}/transfer")
    public R<Void> transferTask(@PathVariable String taskId, @RequestBody TransferTaskRequest request) {
        taskService.transferTask(taskId, request.getTargetUserId());
        return R.ok();
    }

    @PostMapping("/{taskId}/add-sign")
    public R<Void> addSignUser(@PathVariable String taskId, @RequestBody SignUserRequest request) {
        taskService.addSignUser(taskId, request.getUserId(), request.getOperationUserId());
        return R.ok();
    }

    @PostMapping("/{taskId}/reduce-sign")
    public R<Void> reduceSignUser(@PathVariable String taskId, @RequestBody SignUserRequest request) {
        taskService.reduceSignUser(taskId, request.getUserId(), request.getOperationUserId());
        return R.ok();
    }

    @GetMapping("/todo")
    public R<?> queryTodoTasks(TaskQuery query) {
        PageRequest pageRequest = new PageRequest(query.getPageNum(), query.getPageSize());
        return R.success(taskService.queryTodoTasks(query.getAssignee(), query.getTenantId(), pageRequest));
    }

    @GetMapping("/done")
    public R<?> queryDoneTasks(TaskQuery query) {
        PageRequest pageRequest = new PageRequest(query.getPageNum(), query.getPageSize());
        return R.success(taskService.queryDoneTasks(query.getAssignee(), query.getTenantId(), pageRequest));
    }
}
