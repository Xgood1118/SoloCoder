package com.ai.training.statemachine;

import com.ai.training.enums.TrainingStatus;
import com.ai.training.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Component
public class TrainingStateMachine {

    private final Map<TrainingStatus, Set<TrainingStatus>> allowedTransitions;

    public TrainingStateMachine() {
        allowedTransitions = new EnumMap<>(TrainingStatus.class);

        allowedTransitions.put(TrainingStatus.PENDING_TRAINING,
                EnumSet.of(TrainingStatus.TRAINING));

        allowedTransitions.put(TrainingStatus.TRAINING,
                EnumSet.of(TrainingStatus.VALIDATING, TrainingStatus.PENDING_TRAINING));

        allowedTransitions.put(TrainingStatus.VALIDATING,
                EnumSet.of(TrainingStatus.PENDING_DEPLOYMENT, TrainingStatus.TRAINING));

        allowedTransitions.put(TrainingStatus.PENDING_DEPLOYMENT,
                EnumSet.of(TrainingStatus.DEPLOYED, TrainingStatus.VALIDATING));

        allowedTransitions.put(TrainingStatus.DEPLOYED,
                EnumSet.of(TrainingStatus.OFFLINE, TrainingStatus.PENDING_DEPLOYMENT, TrainingStatus.VALIDATING));

        allowedTransitions.put(TrainingStatus.OFFLINE,
                EnumSet.of(TrainingStatus.PENDING_DEPLOYMENT));
    }

    public void validateTransition(TrainingStatus currentStatus, TrainingStatus targetStatus) {
        if (currentStatus == targetStatus) {
            return;
        }

        Set<TrainingStatus> allowedNextStatuses = allowedTransitions.get(currentStatus);
        if (allowedNextStatuses == null || !allowedNextStatuses.contains(targetStatus)) {
            throw new BusinessException(String.format("不允许从状态[%s]直接变更到[%s]",
                    currentStatus.getDescription(), targetStatus.getDescription()));
        }
    }

    public boolean canTransition(TrainingStatus currentStatus, TrainingStatus targetStatus) {
        if (currentStatus == targetStatus) {
            return true;
        }
        Set<TrainingStatus> allowedNextStatuses = allowedTransitions.get(currentStatus);
        return allowedNextStatuses != null && allowedNextStatuses.contains(targetStatus);
    }

    public Set<TrainingStatus> getAllowedNextStatuses(TrainingStatus currentStatus) {
        return allowedTransitions.getOrDefault(currentStatus, EnumSet.noneOf(TrainingStatus.class));
    }
}
