package com.bpm.engine.runtime.delegation;

import com.bpm.engine.common.enums.DelegationType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.runtime.entity.DelegationEntity;
import com.bpm.engine.runtime.repository.DelegationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DelegationServiceImpl implements DelegationService {

    private final DelegationRepository delegationRepository;

    @Override
    @Transactional
    public DelegationEntity createDelegation(String delegatorId, String delegateUserId, DelegationType type,
                                             String processDefinitionId, LocalDateTime effectiveTime,
                                             LocalDateTime expiryTime, String tenantId) {
        if (effectiveTime != null && expiryTime != null && effectiveTime.isAfter(expiryTime)) {
            throw new ProcessExecutionException("INVALID_TIME_RANGE",
                    "Effective time must be before expiry time");
        }

        DelegationEntity entity = new DelegationEntity();
        entity.setDelegatorId(delegatorId);
        entity.setDelegateUserId(delegateUserId);
        entity.setDelegationType(type);
        entity.setProcessDefinitionId(processDefinitionId);
        entity.setEffectiveTime(effectiveTime);
        entity.setExpiryTime(expiryTime);
        entity.setEnabled(true);
        entity.setTenantId(tenantId);
        return delegationRepository.save(entity);
    }

    @Override
    @Transactional
    public void revokeDelegation(String delegationId) {
        DelegationEntity entity = delegationRepository.findById(delegationId)
                .orElseThrow(() -> new ProcessExecutionException("DELEGATION_NOT_FOUND",
                        "Delegation not found: " + delegationId));
        entity.setEnabled(false);
        delegationRepository.save(entity);
    }

    @Override
    public String resolveDelegatedUser(String originalUserId, String processDefinitionId) {
        LocalDateTime now = LocalDateTime.now();
        List<DelegationEntity> delegations = delegationRepository.findActiveDelegations(originalUserId, now);

        for (DelegationEntity delegation : delegations) {
            if (delegation.getProcessDefinitionId() == null
                    || delegation.getProcessDefinitionId().equals(processDefinitionId)) {
                return delegation.getDelegateUserId();
            }
        }
        return null;
    }

    @Override
    public List<DelegationEntity> getActiveDelegations(String delegatorId) {
        LocalDateTime now = LocalDateTime.now();
        return delegationRepository.findActiveDelegations(delegatorId, now);
    }
}
