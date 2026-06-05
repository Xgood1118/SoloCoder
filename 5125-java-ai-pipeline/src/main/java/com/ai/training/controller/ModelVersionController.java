package com.ai.training.controller;

import com.ai.training.common.Result;
import com.ai.training.dto.ModelVersionDTO;
import com.ai.training.dto.VersionCompareResult;
import com.ai.training.entity.ModelVersion;
import com.ai.training.service.ModelVersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/versions")
public class ModelVersionController {

    @Autowired
    private ModelVersionService modelVersionService;

    @PostMapping
    public Result<ModelVersion> createVersion(@Valid @RequestBody ModelVersionDTO dto) {
        return Result.success(modelVersionService.createVersion(dto));
    }

    @GetMapping("/{id}")
    public Result<ModelVersion> getVersion(@PathVariable Long id) {
        return Result.success(modelVersionService.getVersion(id));
    }

    @GetMapping("/task/{taskId}")
    public Result<List<ModelVersion>> getVersionsByTaskId(@PathVariable Long taskId) {
        return Result.success(modelVersionService.getVersionsByTaskId(taskId));
    }

    @GetMapping("/task/{taskId}/latest")
    public Result<ModelVersion> getLatestVersion(@PathVariable Long taskId) {
        Optional<ModelVersion> version = modelVersionService.getLatestVersion(taskId);
        return version.map(Result::success).orElseGet(() -> Result.success(null));
    }

    @GetMapping("/compare")
    public Result<VersionCompareResult> compareVersions(@RequestParam Long versionId1, @RequestParam Long versionId2) {
        return Result.success(modelVersionService.compareVersions(versionId1, versionId2));
    }
}
