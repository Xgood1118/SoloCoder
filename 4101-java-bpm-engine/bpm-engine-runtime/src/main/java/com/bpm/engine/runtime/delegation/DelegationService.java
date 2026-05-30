package com.bpm.engine.runtime.delegation;

import com.bpm.engine.common.enums.DelegationType;
import com.bpm.engine.runtime.entity.DelegationEntity;

import java.time.LocalDateTime;
import java.util.List;

public interface DelegationService {

    DelegationEntity createDelegation(String delegatorId, String delegateUserId, DelegationType type,
                                      String processDefinitionId, LocalDateTime effectiveTime,
                                      LocalDateTime expiryTime, String tenantId);

    void revokeDelegation(String delegationId);

    String resolveDelegatedUser(String originalUserId, String processDefinitionId);

    List<DelegationEntity> getActiveDelegations(String delegatorId);
}
