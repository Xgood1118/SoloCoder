package com.ai.training.service;

import com.ai.training.dto.ApprovalDTO;
import com.ai.training.entity.ApprovalConfig;
import com.ai.training.entity.ApprovalFlow;
import com.ai.training.entity.ModelVersion;
import com.ai.training.entity.TrainingTask;
import com.ai.training.enums.ApprovalStatus;
import com.ai.training.enums.TrainingStatus;
import com.ai.training.exception.BusinessException;
import com.ai.training.repository.ApprovalConfigRepository;
import com.ai.training.repository.ApprovalFlowRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ApprovalService {

    @Autowired
    private ApprovalFlowRepository approvalFlowRepository;

    @Autowired
    private ApprovalConfigRepository approvalConfigRepository;

    @Autowired
    private TrainingTaskService trainingTaskService;

    @Autowired
    private ModelVersionService modelVersionService;

    @Transactional
    public ApprovalFlow submitApproval(ApprovalDTO dto) {
        TrainingTask task = trainingTaskService.getTask(dto.getTaskId());
        if (task.getStatus() != TrainingStatus.PENDING_DEPLOYMENT) {
            throw new BusinessException("只有待部署状态的任务才能提交审批");
        }

        ModelVersion version = modelVersionService.getVersion(dto.getModelVersionId());
        if (!version.getTaskId().equals(dto.getTaskId())) {
            throw new BusinessException("模型版本与任务不匹配");
        }

        ApprovalFlow flow = new ApprovalFlow();
        flow.setTaskId(dto.getTaskId());
        flow.setModelVersionId(dto.getModelVersionId());
        flow.setModelType(task.getModelType());
        flow.setApplicant(dto.getApplicant());
        flow.setStatus(ApprovalStatus.PENDING);

        return approvalFlowRepository.save(flow);
    }

    @Transactional
    public ApprovalFlow approve(Long approvalId, String approver, String comment) {
        ApprovalFlow flow = getApprovalFlow(approvalId);
        if (flow.getStatus() != ApprovalStatus.PENDING) {
            throw new BusinessException("该审批已处理");
        }

        validateApprover(flow.getModelType(), approver);

        flow.setStatus(ApprovalStatus.APPROVED);
        flow.setApprover(approver);
        flow.setApprovalComment(comment);
        flow.setApprovedAt(LocalDateTime.now());

        trainingTaskService.deploy(flow.getTaskId());

        return approvalFlowRepository.save(flow);
    }

    @Transactional
    public ApprovalFlow reject(Long approvalId, String approver, String comment) {
        ApprovalFlow flow = getApprovalFlow(approvalId);
        if (flow.getStatus() != ApprovalStatus.PENDING) {
            throw new BusinessException("该审批已处理");
        }

        validateApprover(flow.getModelType(), approver);

        flow.setStatus(ApprovalStatus.REJECTED);
        flow.setApprover(approver);
        flow.setApprovalComment(comment);
        flow.setApprovedAt(LocalDateTime.now());

        return approvalFlowRepository.save(flow);
    }

    private void validateApprover(com.ai.training.enums.ModelType modelType, String approver) {
        Optional<ApprovalConfig> configOpt = approvalConfigRepository.findByModelType(modelType);
        if (configOpt.isPresent()) {
            String approvers = configOpt.get().getApprovers();
            boolean isValidApprover = List.of(approvers.split(",")).contains(approver);
            if (!isValidApprover) {
                throw new BusinessException("您没有该类型模型的审批权限");
            }
        }
    }

    public ApprovalFlow getApprovalFlow(Long id) {
        return approvalFlowRepository.findById(id)
                .orElseThrow(() -> new BusinessException("审批流不存在"));
    }

    public List<ApprovalFlow> getApprovalsByTaskId(Long taskId) {
        return approvalFlowRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    public List<ApprovalFlow> getPendingApprovals() {
        return approvalFlowRepository.findByStatus(ApprovalStatus.PENDING);
    }

    @Transactional
    public ApprovalConfig setApprovalConfig(com.ai.training.enums.ModelType modelType, String approvers, String createdBy) {
        Optional<ApprovalConfig> existingOpt = approvalConfigRepository.findByModelType(modelType);
        ApprovalConfig config;
        if (existingOpt.isPresent()) {
            config = existingOpt.get();
        } else {
            config = new ApprovalConfig();
            config.setModelType(modelType);
            config.setCreatedBy(createdBy);
        }
        config.setApprovers(approvers);
        return approvalConfigRepository.save(config);
    }

    public ApprovalConfig getApprovalConfig(com.ai.training.enums.ModelType modelType) {
        return approvalConfigRepository.findByModelType(modelType).orElse(null);
    }

    public List<ApprovalConfig> getAllApprovalConfigs() {
        return approvalConfigRepository.findAll();
    }
}
