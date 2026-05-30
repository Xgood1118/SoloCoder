package com.featureflag.service;

import com.featureflag.cache.FlagCacheManager;
import com.featureflag.entity.FeatureFlag;
import com.featureflag.entity.FeatureRule;
import com.featureflag.entity.GrayBatch;
import com.featureflag.repository.FeatureFlagRepository;
import com.featureflag.repository.GrayBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GrayBatchService {

    private final GrayBatchRepository grayBatchRepository;
    private final FeatureFlagRepository featureFlagRepository;
    private final FlagCacheManager flagCacheManager;
    private final FlagChangeEventService changeEventService;

    public List<GrayBatch> getBatchesByFlag(Long flagId) {
        return grayBatchRepository.findByFeatureFlagIdOrderByBatchOrderAsc(flagId);
    }

    @Transactional
    public GrayBatch createBatch(Long flagId, GrayBatch batch, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + flagId));

        batch.setFeatureFlag(flag);
        batch.setCreatedBy(operator);
        batch.setUpdatedBy(operator);

        if (batch.getRule() != null) {
            batch.getRule().setFeatureFlag(flag);
        }

        GrayBatch saved = grayBatchRepository.save(batch);

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());
        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "GRAY_BATCH_CREATE", flag.getVersion());

        return saved;
    }

    @Transactional
    public GrayBatch updateBatch(Long batchId, GrayBatch batch, String operator) {
        GrayBatch existing = grayBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + batchId));

        existing.setBatchName(batch.getBatchName());
        existing.setBatchCode(batch.getBatchCode());
        existing.setBatchOrder(batch.getBatchOrder());
        existing.setStatus(batch.getStatus());
        existing.setDescription(batch.getDescription());
        existing.setTargetUserCount(batch.getTargetUserCount());
        existing.setUpdatedBy(operator);

        if (batch.getRule() != null && existing.getRule() != null) {
            existing.getRule().setPercentage(batch.getRule().getPercentage());
            existing.getRule().setConditions(batch.getRule().getConditions());
        }

        GrayBatch saved = grayBatchRepository.save(existing);

        flagCacheManager.invalidateFlagCache(existing.getFeatureFlag().getFlagKey());
        changeEventService.publishChangeEvent(
                existing.getFeatureFlag().getFlagKey(),
                existing.getFeatureFlag().getApplication(),
                "GRAY_BATCH_UPDATE",
                existing.getFeatureFlag().getVersion()
        );

        return saved;
    }

    @Transactional
    public void deleteBatch(Long batchId) {
        GrayBatch batch = grayBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + batchId));

        String flagKey = batch.getFeatureFlag().getFlagKey();
        String application = batch.getFeatureFlag().getApplication();
        Long version = batch.getFeatureFlag().getVersion();

        grayBatchRepository.delete(batch);

        flagCacheManager.invalidateFlagCache(flagKey);
        changeEventService.publishChangeEvent(flagKey, application, "GRAY_BATCH_DELETE", version);
    }

    @Transactional
    public GrayBatch toggleBatch(Long batchId, boolean enabled, String operator) {
        GrayBatch batch = grayBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + batchId));

        batch.setStatus(enabled ? com.featureflag.enums.FeatureFlagStatus.ON : com.featureflag.enums.FeatureFlagStatus.OFF);
        batch.setUpdatedBy(operator);

        GrayBatch saved = grayBatchRepository.save(batch);

        flagCacheManager.invalidateFlagCache(batch.getFeatureFlag().getFlagKey());
        changeEventService.publishChangeEvent(
                batch.getFeatureFlag().getFlagKey(),
                batch.getFeatureFlag().getApplication(),
                "GRAY_BATCH_TOGGLE",
                batch.getFeatureFlag().getVersion()
        );

        return saved;
    }
}
