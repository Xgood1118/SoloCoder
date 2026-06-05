package com.ai.training.service;

import com.ai.training.dto.RollbackDTO;
import com.ai.training.entity.ModelVersion;
import com.ai.training.entity.RollbackRecord;
import com.ai.training.entity.TrainingTask;
import com.ai.training.enums.TrainingStatus;
import com.ai.training.exception.BusinessException;
import com.ai.training.repository.RollbackRecordRepository;
import com.ai.training.statemachine.TrainingStateMachine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class RollbackService {

    @Autowired
    private RollbackRecordRepository rollbackRecordRepository;

    @Autowired
    private TrainingTaskService trainingTaskService;

    @Autowired
    private ModelVersionService modelVersionService;

    @Autowired
    private TrainingStateMachine stateMachine;

    @Transactional
    public RollbackRecord rollback(RollbackDTO dto) {
        TrainingTask task = trainingTaskService.getTask(dto.getTaskId());
        TrainingStatus currentStatus = task.getStatus();

        if (currentStatus != TrainingStatus.DEPLOYED && currentStatus != TrainingStatus.OFFLINE) {
            throw new BusinessException("只有已上线或已下线的模型才能执行回滚");
        }

        ModelVersion targetVersion = modelVersionService.getVersion(dto.getToVersionId());
        if (!targetVersion.getTaskId().equals(dto.getTaskId())) {
            throw new BusinessException("目标版本不属于该任务");
        }

        stateMachine.validateTransition(currentStatus, dto.getTargetStatus());

        if (dto.getTargetStatus() != TrainingStatus.PENDING_DEPLOYMENT
                && dto.getTargetStatus() != TrainingStatus.VALIDATING) {
            throw new BusinessException("回滚只能到待部署或验证中状态");
        }

        Optional<ModelVersion> currentVersionOpt = modelVersionService.getLatestVersion(dto.getTaskId());
        Long fromVersionId = currentVersionOpt.map(ModelVersion::getId).orElse(null);

        trainingTaskService.updateStatus(dto.getTaskId(), dto.getTargetStatus());

        RollbackRecord record = new RollbackRecord();
        record.setTaskId(dto.getTaskId());
        record.setFromVersionId(fromVersionId);
        record.setToVersionId(dto.getToVersionId());
        record.setTargetStatus(dto.getTargetStatus());
        record.setRollbackReason(dto.getRollbackReason());
        record.setOperator(dto.getOperator());

        return rollbackRecordRepository.save(record);
    }

    public List<RollbackRecord> getRollbackRecordsByTaskId(Long taskId) {
        return rollbackRecordRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    public RollbackRecord getRollbackRecord(Long id) {
        return rollbackRecordRepository.findById(id)
                .orElseThrow(() -> new BusinessException("回滚记录不存在"));
    }
}
