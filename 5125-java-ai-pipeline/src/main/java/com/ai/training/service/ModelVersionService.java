package com.ai.training.service;

import com.ai.training.dto.ModelVersionDTO;
import com.ai.training.dto.VersionCompareResult;
import com.ai.training.entity.ModelVersion;
import com.ai.training.entity.TrainingTask;
import com.ai.training.exception.BusinessException;
import com.ai.training.repository.ModelVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class ModelVersionService {

    @Autowired
    private ModelVersionRepository modelVersionRepository;

    @Autowired
    private TrainingTaskService trainingTaskService;

    @Transactional
    public ModelVersion createVersion(ModelVersionDTO dto) {
        TrainingTask task = trainingTaskService.getTask(dto.getTaskId());

        ModelVersion version = new ModelVersion();
        version.setTaskId(dto.getTaskId());
        version.setTrainingParams(dto.getTrainingParams());
        version.setDatasetSummary(dto.getDatasetSummary());
        version.setAccuracy(dto.getAccuracy());
        version.setLoss(dto.getLoss());
        version.setPrecision(dto.getPrecision());
        version.setRecall(dto.getRecall());
        version.setF1Score(dto.getF1Score());
        version.setModelPath(dto.getModelPath());
        version.setCreatedBy(dto.getCreatedBy());

        String nextVersion = generateNextVersion(dto.getTaskId());
        version.setVersionNumber(nextVersion);

        List<ModelVersion> previousVersions = modelVersionRepository.findLatestByTaskId(dto.getTaskId());
        if (!previousVersions.isEmpty()) {
            version.setPreviousVersionId(previousVersions.get(0).getId());
        }

        return modelVersionRepository.save(version);
    }

    private String generateNextVersion(Long taskId) {
        Optional<String> latestVersionOpt = modelVersionRepository.findLatestVersionNumberByTaskId(taskId);
        if (latestVersionOpt.isEmpty() || latestVersionOpt.get() == null) {
            return "v1.0.0";
        }

        String latestVersion = latestVersionOpt.get();
        String[] parts = latestVersion.replace("v", "").split("\\.");
        if (parts.length != 3) {
            return "v1.0.0";
        }

        try {
            int major = Integer.parseInt(parts[0]);
            int minor = Integer.parseInt(parts[1]);
            int patch = Integer.parseInt(parts[2]) + 1;
            return String.format("v%d.%d.%d", major, minor, patch);
        } catch (NumberFormatException e) {
            return "v1.0.0";
        }
    }

    public ModelVersion getVersion(Long id) {
        return modelVersionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("模型版本不存在"));
    }

    public List<ModelVersion> getVersionsByTaskId(Long taskId) {
        return modelVersionRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    public VersionCompareResult compareVersions(Long versionId1, Long versionId2) {
        ModelVersion v1 = getVersion(versionId1);
        ModelVersion v2 = getVersion(versionId2);

        VersionCompareResult result = new VersionCompareResult();
        result.setVersion1(v1);
        result.setVersion2(v2);

        result.setAccuracyDiff(subtract(v2.getAccuracy(), v1.getAccuracy()));
        result.setLossDiff(subtract(v2.getLoss(), v1.getLoss()));
        result.setPrecisionDiff(subtract(v2.getPrecision(), v1.getPrecision()));
        result.setRecallDiff(subtract(v2.getRecall(), v1.getRecall()));
        result.setF1ScoreDiff(subtract(v2.getF1Score(), v1.getF1Score()));

        return result;
    }

    private BigDecimal subtract(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return BigDecimal.ZERO;
        if (a == null) return b.negate();
        if (b == null) return a;
        return a.subtract(b);
    }

    public Optional<ModelVersion> getLatestVersion(Long taskId) {
        List<ModelVersion> versions = modelVersionRepository.findLatestByTaskId(taskId);
        return versions.isEmpty() ? Optional.empty() : Optional.of(versions.get(0));
    }
}
