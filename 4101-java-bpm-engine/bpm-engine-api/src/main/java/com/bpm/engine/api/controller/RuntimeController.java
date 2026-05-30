package com.bpm.engine.api.controller;

import com.bpm.engine.api.dto.R;
import com.bpm.engine.api.dto.StartProcessRequest;
import com.bpm.engine.runtime.control.ProcessControlService;
import com.bpm.engine.runtime.service.RuntimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/bpm/runtime")
@RequiredArgsConstructor
public class RuntimeController {

    private final RuntimeService runtimeService;
    private final ProcessControlService processControlService;

    @PostMapping("/start")
    public R<?> startProcess(@RequestBody StartProcessRequest request) {
        if (request.getDefinitionId() != null && !request.getDefinitionId().isEmpty()) {
            return R.success(runtimeService.startProcessById(
                    request.getDefinitionId(),
                    request.getBusinessKey(),
                    request.getStartUserId(),
                    request.getVariables(),
                    request.getTenantId()));
        }
        return R.success(runtimeService.startProcessByKey(
                request.getProcessKey(),
                request.getBusinessKey(),
                request.getStartUserId(),
                request.getVariables(),
                request.getTenantId()));
    }

    @GetMapping("/instance/{processInstanceId}")
    public R<?> getProcessInstance(@PathVariable String processInstanceId) {
        return R.success(runtimeService.getProcessInstance(processInstanceId));
    }

    @GetMapping("/instance/{processInstanceId}/executions")
    public R<?> getActiveExecutions(@PathVariable String processInstanceId) {
        return R.success(runtimeService.getActiveExecutions(processInstanceId));
    }

    @GetMapping("/instance/{processInstanceId}/variables")
    public R<?> getProcessVariables(@PathVariable String processInstanceId) {
        return R.success(runtimeService.getProcessVariables(processInstanceId));
    }

    @PostMapping("/instance/{processInstanceId}/variables")
    public R<Void> setProcessVariable(@PathVariable String processInstanceId,
                                      @RequestParam String variableName,
                                      @RequestBody Object value) {
        runtimeService.setProcessVariable(processInstanceId, variableName, value);
        return R.ok();
    }

    @PutMapping("/instance/{processInstanceId}/suspend")
    public R<Void> suspendProcessInstance(@PathVariable String processInstanceId) {
        processControlService.suspendProcessInstance(processInstanceId);
        return R.ok();
    }

    @PutMapping("/instance/{processInstanceId}/activate")
    public R<Void> activateProcessInstance(@PathVariable String processInstanceId) {
        processControlService.activateProcessInstance(processInstanceId);
        return R.ok();
    }

    @DeleteMapping("/instance/{processInstanceId}")
    public R<Void> deleteProcessInstance(@PathVariable String processInstanceId,
                                         @RequestParam(required = false) String reason,
                                         @RequestParam(defaultValue = "false") boolean physicalDelete) {
        processControlService.deleteProcessInstance(processInstanceId, reason, physicalDelete);
        return R.ok();
    }

    @PostMapping("/execution/{executionId}/signal")
    public R<Void> signalExecution(@PathVariable String executionId,
                                   @RequestBody(required = false) Map<String, Object> variables) {
        runtimeService.signalExecution(executionId, variables);
        return R.ok();
    }
}
