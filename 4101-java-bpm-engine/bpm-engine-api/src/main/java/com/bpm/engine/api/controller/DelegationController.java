package com.bpm.engine.api.controller;

import com.bpm.engine.api.dto.DelegationRequest;
import com.bpm.engine.api.dto.R;
import com.bpm.engine.runtime.delegation.DelegationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bpm/delegation")
@RequiredArgsConstructor
public class DelegationController {

    private final DelegationService delegationService;

    @PostMapping
    public R<?> createDelegation(@RequestBody DelegationRequest request) {
        return R.success(delegationService.createDelegation(
                request.getDelegatorId(),
                request.getDelegateUserId(),
                request.getType(),
                request.getProcessDefinitionId(),
                request.getEffectiveTime(),
                request.getExpiryTime(),
                request.getTenantId()));
    }

    @DeleteMapping("/{delegationId}")
    public R<Void> revokeDelegation(@PathVariable String delegationId) {
        delegationService.revokeDelegation(delegationId);
        return R.ok();
    }

    @GetMapping("/active")
    public R<?> getActiveDelegations(@RequestParam String delegatorId) {
        return R.success(delegationService.getActiveDelegations(delegatorId));
    }
}
