package com.bpm.engine.api.controller;

import com.bpm.engine.api.dto.DeployRequest;
import com.bpm.engine.api.dto.R;
import com.bpm.engine.bpmn.service.ProcessDefinitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bpm/definition")
@RequiredArgsConstructor
public class ProcessDefinitionController {

    private final ProcessDefinitionService processDefinitionService;

    @PostMapping("/deploy")
    public R<?> deploy(@RequestBody DeployRequest request) {
        return R.success(processDefinitionService.deploy(request.getXml(), request.getTenantId()));
    }

    @GetMapping("/{definitionId}")
    public R<?> getProcessDefinition(@PathVariable String definitionId) {
        return R.success(processDefinitionService.getProcessDefinition(definitionId));
    }

    @GetMapping("/latest/{processKey}")
    public R<?> getLatestProcessDefinition(@PathVariable String processKey) {
        return R.success(processDefinitionService.getLatestProcessDefinition(processKey));
    }

    @GetMapping("/list")
    public R<?> listDefinitions(@RequestParam(required = false) String processKey) {
        return R.success(processDefinitionService.listDefinitions(processKey));
    }

    @PutMapping("/{definitionId}/suspend")
    public R<Void> suspendDefinition(@PathVariable String definitionId) {
        processDefinitionService.suspendDefinition(definitionId);
        return R.ok();
    }

    @PutMapping("/{definitionId}/activate")
    public R<Void> activateDefinition(@PathVariable String definitionId) {
        processDefinitionService.activateDefinition(definitionId);
        return R.ok();
    }

    @DeleteMapping("/{definitionId}")
    public R<Void> deleteDefinition(@PathVariable String definitionId,
                                    @RequestParam(defaultValue = "false") boolean physical) {
        processDefinitionService.deleteDefinition(definitionId, physical);
        return R.ok();
    }
}
