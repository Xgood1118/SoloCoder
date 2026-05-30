package com.featureflag.service;

import com.featureflag.cache.FlagCacheManager;
import com.featureflag.entity.FeatureFlag;
import com.featureflag.entity.WhiteList;
import com.featureflag.repository.FeatureFlagRepository;
import com.featureflag.repository.WhiteListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WhiteListService {

    private final WhiteListRepository whiteListRepository;
    private final FeatureFlagRepository featureFlagRepository;
    private final FlagCacheManager flagCacheManager;
    private final FlagChangeEventService changeEventService;

    public List<WhiteList> getWhiteListByFlag(Long flagId) {
        return whiteListRepository.findByFeatureFlagId(flagId);
    }

    @Transactional
    public WhiteList addUserToWhiteList(Long flagId, String userId, String description, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + flagId));

        WhiteList whiteList = new WhiteList();
        whiteList.setFeatureFlag(flag);
        whiteList.setUserId(userId);
        whiteList.setDescription(description);
        whiteList.setCreatedBy(operator);

        WhiteList saved = whiteListRepository.save(whiteList);

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());
        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "WHITELIST_ADD", flag.getVersion());

        return saved;
    }

    @Transactional
    public WhiteList addTagToWhiteList(Long flagId, String userTag, String description, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + flagId));

        WhiteList whiteList = new WhiteList();
        whiteList.setFeatureFlag(flag);
        whiteList.setUserTag(userTag);
        whiteList.setDescription(description);
        whiteList.setCreatedBy(operator);

        WhiteList saved = whiteListRepository.save(whiteList);

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());
        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "WHITELIST_ADD", flag.getVersion());

        return saved;
    }

    @Transactional
    public void batchAddUsers(Long flagId, List<String> userIds, String operator) {
        FeatureFlag flag = featureFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + flagId));

        for (String userId : userIds) {
            WhiteList whiteList = new WhiteList();
            whiteList.setFeatureFlag(flag);
            whiteList.setUserId(userId);
            whiteList.setCreatedBy(operator);
            whiteListRepository.save(whiteList);
        }

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());
        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "WHITELIST_BATCH_ADD", flag.getVersion());
    }

    @Transactional
    public void removeFromWhiteList(Long whiteListId) {
        WhiteList whiteList = whiteListRepository.findById(whiteListId)
                .orElseThrow(() -> new IllegalArgumentException("WhiteList entry not found: " + whiteListId));

        String flagKey = whiteList.getFeatureFlag().getFlagKey();
        String application = whiteList.getFeatureFlag().getApplication();
        Long version = whiteList.getFeatureFlag().getVersion();

        whiteListRepository.delete(whiteList);

        flagCacheManager.invalidateFlagCache(flagKey);
        changeEventService.publishChangeEvent(flagKey, application, "WHITELIST_REMOVE", version);
    }

    @Transactional
    public void clearWhiteList(Long flagId) {
        FeatureFlag flag = featureFlagRepository.findById(flagId)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + flagId));

        whiteListRepository.deleteByFeatureFlagId(flagId);

        flagCacheManager.invalidateFlagCache(flag.getFlagKey());
        changeEventService.publishChangeEvent(flag.getFlagKey(), flag.getApplication(), "WHITELIST_CLEAR", flag.getVersion());
    }
}
