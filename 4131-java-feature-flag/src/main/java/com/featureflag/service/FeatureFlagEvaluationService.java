package com.featureflag.service;

import com.featureflag.entity.FeatureFlag;
import com.featureflag.entity.FeatureRule;
import com.featureflag.entity.GrayBatch;
import com.featureflag.entity.WhiteList;
import com.featureflag.engine.RuleEvaluator;
import com.featureflag.enums.FeatureFlagStatus;
import com.featureflag.repository.FeatureFlagRepository;
import com.featureflag.repository.GrayBatchRepository;
import com.featureflag.repository.WhiteListRepository;
import com.featureflag.dto.FlagEvaluationRequest;
import com.featureflag.dto.FlagEvaluationResponse;
import com.featureflag.dto.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeatureFlagEvaluationService {

    private final FeatureFlagRepository featureFlagRepository;
    private final WhiteListRepository whiteListRepository;
    private final GrayBatchRepository grayBatchRepository;
    private final RuleEvaluator ruleEvaluator;

    public FlagEvaluationResponse evaluate(FlagEvaluationRequest request) {
        String cacheKey = generateCacheKey(request);

        try {
            return evaluateInternal(request);
        } catch (Exception e) {
            log.error("Error evaluating feature flag: {}", request.getFlagKey(), e);
            return FlagEvaluationResponse.builder()
                    .flagKey(request.getFlagKey())
                    .enabled(request.getDefaultValue())
                    .reason("ERROR: " + e.getMessage())
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
    }

    @Cacheable(value = "flagEvaluations", key = "#cacheKey", unless = "#result == null")
    public FlagEvaluationResponse evaluateWithCache(FlagEvaluationRequest request, String cacheKey) {
        return evaluateInternal(request);
    }

    private FlagEvaluationResponse evaluateInternal(FlagEvaluationRequest request) {
        com.featureflag.enums.Environment environment = parseEnvironment(request.getEnvironment());

        FeatureFlag flag = featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                request.getFlagKey(),
                request.getApplication(),
                environment
        ).orElse(null);

        if (flag == null) {
            return FlagEvaluationResponse.builder()
                    .flagKey(request.getFlagKey())
                    .enabled(request.getDefaultValue())
                    .reason("FLAG_NOT_FOUND")
                    .timestamp(System.currentTimeMillis())
                    .build();
        }

        UserContext userContext = request.getUserContext();

        if (isInWhitelist(flag.getId(), userContext)) {
            return FlagEvaluationResponse.builder()
                    .flagKey(request.getFlagKey())
                    .enabled(true)
                    .reason("WHITELIST_MATCH")
                    .timestamp(System.currentTimeMillis())
                    .build();
        }

        if (flag.getStatus() == FeatureFlagStatus.OFF) {
            return FlagEvaluationResponse.builder()
                    .flagKey(request.getFlagKey())
                    .enabled(false)
                    .reason("FLAG_DISABLED")
                    .timestamp(System.currentTimeMillis())
                    .build();
        }

        if (flag.getStatus() == FeatureFlagStatus.ON && flag.getRules().isEmpty() && flag.getGrayBatches().isEmpty()) {
            return FlagEvaluationResponse.builder()
                    .flagKey(request.getFlagKey())
                    .enabled(true)
                    .reason("FLAG_ENABLED_NO_RULES")
                    .timestamp(System.currentTimeMillis())
                    .build();
        }

        FlagEvaluationResponse grayBatchResult = evaluateGrayBatches(flag, userContext);
        if (grayBatchResult != null) {
            return grayBatchResult;
        }

        FlagEvaluationResponse ruleResult = evaluateRules(flag, userContext);
        if (ruleResult != null) {
            return ruleResult;
        }

        return FlagEvaluationResponse.builder()
                .flagKey(request.getFlagKey())
                .enabled(flag.getDefaultValue())
                .reason("NO_RULE_MATCHED")
                .timestamp(System.currentTimeMillis())
                .build();
    }

    private boolean isInWhitelist(Long flagId, UserContext userContext) {
        if (userContext == null) {
            return false;
        }

        String userId = userContext.getUserId();
        List<String> userTags = userContext.getUserTags();

        if (userId == null && (userTags == null || userTags.isEmpty())) {
            return false;
        }

        List<WhiteList> whiteLists = whiteListRepository.findMatchingWhiteList(flagId, userId,
                userTags != null ? userTags : List.of());

        return !whiteLists.isEmpty();
    }

    private FlagEvaluationResponse evaluateGrayBatches(FeatureFlag flag, UserContext userContext) {
        List<GrayBatch> batches = grayBatchRepository.findByFeatureFlagIdOrderByBatchOrderAsc(flag.getId());

        for (GrayBatch batch : batches) {
            if (batch.getStatus() != FeatureFlagStatus.ON) {
                continue;
            }

            if (batch.getRule() != null) {
                boolean matched = ruleEvaluator.evaluateRule(batch.getRule(), userContext, flag.getFlagKey());
                if (matched) {
                    return FlagEvaluationResponse.builder()
                            .flagKey(flag.getFlagKey())
                            .enabled(true)
                            .reason("GRAY_BATCH_MATCH: " + batch.getBatchCode())
                            .grayBatch(batch.getBatchCode())
                            .matchedRule(batch.getRule().getRuleName())
                            .timestamp(System.currentTimeMillis())
                            .build();
                }
            }
        }

        return null;
    }

    private FlagEvaluationResponse evaluateRules(FeatureFlag flag, UserContext userContext) {
        List<FeatureRule> rules = flag.getRules().stream()
                .filter(FeatureRule::getEnabled)
                .sorted(Comparator.comparing(FeatureRule::getPriority).reversed())
                .toList();

        for (FeatureRule rule : rules) {
            boolean matched = ruleEvaluator.evaluateRule(rule, userContext, flag.getFlagKey());
            if (matched) {
                return FlagEvaluationResponse.builder()
                        .flagKey(flag.getFlagKey())
                        .enabled(true)
                        .reason("RULE_MATCH")
                        .matchedRule(rule.getRuleName())
                        .timestamp(System.currentTimeMillis())
                        .build();
            }
        }

        return null;
    }

    private String generateCacheKey(FlagEvaluationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append(request.getApplication()).append(":")
                .append(request.getEnvironment()).append(":")
                .append(request.getFlagKey());

        if (request.getUserContext() != null && request.getUserContext().getUserId() != null) {
            sb.append(":").append(request.getUserContext().getUserId());
        }

        return sb.toString();
    }

    private com.featureflag.enums.Environment parseEnvironment(String env) {
        if (env == null) {
            return com.featureflag.enums.Environment.PRODUCTION;
        }
        try {
            return com.featureflag.enums.Environment.valueOf(env.toUpperCase());
        } catch (IllegalArgumentException e) {
            return com.featureflag.enums.Environment.PRODUCTION;
        }
    }
}
