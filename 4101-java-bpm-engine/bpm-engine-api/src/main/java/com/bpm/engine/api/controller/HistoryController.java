package com.bpm.engine.api.controller;

import com.bpm.engine.api.dto.ArchiveRequest;
import com.bpm.engine.api.dto.HistoryActivityQuery;
import com.bpm.engine.api.dto.HistoryTaskQuery;
import com.bpm.engine.api.dto.R;
import com.bpm.engine.common.model.PageRequest;
import com.bpm.engine.history.archive.HistoryArchiveService;
import com.bpm.engine.history.service.HistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bpm/history")
@RequiredArgsConstructor
public class HistoryController {

    private final HistoryService historyService;
    private final HistoryArchiveService historyArchiveService;

    @GetMapping("/process-instance/{processInstanceId}")
    public R<?> getHistoricProcessInstance(@PathVariable String processInstanceId) {
        return R.success(historyService.getHistoricProcessInstance(processInstanceId));
    }

    @GetMapping("/task")
    public R<?> queryHistoricTasks(HistoryTaskQuery query) {
        PageRequest pageRequest = new PageRequest(query.getPageNum(), query.getPageSize());
        return R.success(historyService.queryHistoricTasks(
                query.getAssignee(), query.getStatus(), query.getProcessInstanceId(),
                query.getTenantId(), pageRequest));
    }

    @GetMapping("/activity")
    public R<?> queryHistoricActivities(HistoryActivityQuery query) {
        PageRequest pageRequest = new PageRequest(query.getPageNum(), query.getPageSize());
        return R.success(historyService.queryHistoricActivities(
                query.getProcessInstanceId(), query.getActivityId(),
                query.getAssignee(), pageRequest));
    }

    @GetMapping("/process-instance/{processInstanceId}/variables")
    public R<?> getHistoricVariables(@PathVariable String processInstanceId) {
        return R.success(historyService.getHistoricVariables(processInstanceId));
    }

    @GetMapping("/process-instance/{processInstanceId}/audit-trail")
    public R<?> getProcessAuditTrail(@PathVariable String processInstanceId) {
        return R.success(historyService.getProcessAuditTrail(processInstanceId));
    }

    @PostMapping("/archive")
    public R<?> archiveProcessInstances(@RequestBody ArchiveRequest request) {
        historyArchiveService.archiveProcessInstances(request.getBefore(), request.getBatchSize());
        return R.ok();
    }

    @PostMapping("/archive/cleanup")
    public R<?> cleanupArchivedData(@RequestBody ArchiveRequest request) {
        historyArchiveService.cleanupArchivedData(request.getBefore(), request.getBatchSize());
        return R.ok();
    }
}
