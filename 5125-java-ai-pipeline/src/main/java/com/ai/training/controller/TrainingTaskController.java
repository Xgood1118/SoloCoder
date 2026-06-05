package com.ai.training.controller;

import com.ai.training.common.Result;
import com.ai.training.dto.CheckpointDTO;
import com.ai.training.dto.TrainingTaskDTO;
import com.ai.training.entity.TrainingTask;
import com.ai.training.enums.TrainingStatus;
import com.ai.training.service.TrainingTaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TrainingTaskController {

    @Autowired
    private TrainingTaskService trainingTaskService;

    @PostMapping
    public Result<TrainingTask> createTask(@Valid @RequestBody TrainingTaskDTO dto) {
        return Result.success(trainingTaskService.createTask(dto));
    }

    @GetMapping("/{id}")
    public Result<TrainingTask> getTask(@PathVariable Long id) {
        return Result.success(trainingTaskService.getTask(id));
    }

    @GetMapping
    public Result<List<TrainingTask>> getAllTasks() {
        return Result.success(trainingTaskService.getAllTasks());
    }

    @GetMapping("/status/{status}")
    public Result<List<TrainingTask>> getTasksByStatus(@PathVariable TrainingStatus status) {
        return Result.success(trainingTaskService.getTasksByStatus(status));
    }

    @PutMapping("/{id}/status")
    public Result<TrainingTask> updateStatus(@PathVariable Long id, @RequestParam TrainingStatus status) {
        return Result.success(trainingTaskService.updateStatus(id, status));
    }

    @PostMapping("/{id}/start-training")
    public Result<TrainingTask> startTraining(@PathVariable Long id, @RequestParam String gpuNode) {
        return Result.success(trainingTaskService.startTraining(id, gpuNode));
    }

    @PostMapping("/{id}/complete-training")
    public Result<TrainingTask> completeTraining(@PathVariable Long id) {
        return Result.success(trainingTaskService.completeTraining(id));
    }

    @PostMapping("/{id}/complete-validation")
    public Result<TrainingTask> completeValidation(@PathVariable Long id) {
        return Result.success(trainingTaskService.completeValidation(id));
    }

    @PostMapping("/{id}/deploy")
    public Result<TrainingTask> deploy(@PathVariable Long id) {
        return Result.success(trainingTaskService.deploy(id));
    }

    @PostMapping("/{id}/offline")
    public Result<TrainingTask> offline(@PathVariable Long id) {
        return Result.success(trainingTaskService.offline(id));
    }

    @PostMapping("/{id}/checkpoint")
    public Result<TrainingTask> updateCheckpoint(@PathVariable Long id, @Valid @RequestBody CheckpointDTO dto) {
        return Result.success(trainingTaskService.updateCheckpoint(id, dto.getCheckpointPath(), dto.getGpuNode()));
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteTask(@PathVariable Long id) {
        trainingTaskService.deleteTask(id);
        return Result.success();
    }
}
