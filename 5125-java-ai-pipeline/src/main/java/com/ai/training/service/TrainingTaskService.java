package com.ai.training.service;

import com.ai.training.dto.TrainingTaskDTO;
import com.ai.training.entity.TrainingTask;
import com.ai.training.enums.TrainingStatus;
import com.ai.training.exception.BusinessException;
import com.ai.training.repository.TrainingTaskRepository;
import com.ai.training.statemachine.TrainingStateMachine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TrainingTaskService {

    @Autowired
    private TrainingTaskRepository trainingTaskRepository;

    @Autowired
    private TrainingStateMachine stateMachine;

    public TrainingTask createTask(TrainingTaskDTO dto) {
        TrainingTask task = new TrainingTask();
        task.setTaskName(dto.getTaskName());
        task.setModelType(dto.getModelType());
        task.setTrainingParams(dto.getTrainingParams());
        task.setDatasetSummary(dto.getDatasetSummary());
        task.setSubmitter(dto.getSubmitter());
        task.setRemark(dto.getRemark());
        task.setStatus(TrainingStatus.PENDING_TRAINING);
        return trainingTaskRepository.save(task);
    }

    public TrainingTask getTask(Long id) {
        return trainingTaskRepository.findById(id)
                .orElseThrow(() -> new BusinessException("任务不存在"));
    }

    public List<TrainingTask> getAllTasks() {
        return trainingTaskRepository.findAll();
    }

    public List<TrainingTask> getTasksByStatus(TrainingStatus status) {
        return trainingTaskRepository.findByStatus(status);
    }

    @Transactional
    public TrainingTask updateStatus(Long taskId, TrainingStatus targetStatus) {
        TrainingTask task = getTask(taskId);
        TrainingStatus currentStatus = task.getStatus();

        stateMachine.validateTransition(currentStatus, targetStatus);
        task.setStatus(targetStatus);
        return trainingTaskRepository.save(task);
    }

    @Transactional
    public TrainingTask startTraining(Long taskId, String gpuNode) {
        TrainingTask task = updateStatus(taskId, TrainingStatus.TRAINING);
        task.setGpuNode(gpuNode);
        return trainingTaskRepository.save(task);
    }

    @Transactional
    public TrainingTask completeTraining(Long taskId) {
        return updateStatus(taskId, TrainingStatus.VALIDATING);
    }

    @Transactional
    public TrainingTask completeValidation(Long taskId) {
        return updateStatus(taskId, TrainingStatus.PENDING_DEPLOYMENT);
    }

    @Transactional
    public TrainingTask deploy(Long taskId) {
        return updateStatus(taskId, TrainingStatus.DEPLOYED);
    }

    @Transactional
    public TrainingTask offline(Long taskId) {
        return updateStatus(taskId, TrainingStatus.OFFLINE);
    }

    @Transactional
    public TrainingTask updateCheckpoint(Long taskId, String checkpointPath, String gpuNode) {
        TrainingTask task = getTask(taskId);
        task.setCheckpointPath(checkpointPath);
        task.setLastCheckpointTime(LocalDateTime.now());
        if (gpuNode != null) {
            task.setGpuNode(gpuNode);
        }
        return trainingTaskRepository.save(task);
    }

    public void deleteTask(Long id) {
        if (!trainingTaskRepository.existsById(id)) {
            throw new BusinessException("任务不存在");
        }
        trainingTaskRepository.deleteById(id);
    }
}
