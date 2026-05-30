package com.featureflag.service;

import com.featureflag.dto.FlagEvaluationRequest;
import com.featureflag.dto.FlagEvaluationResponse;
import com.featureflag.dto.UserContext;
import com.featureflag.entity.FeatureFlag;
import com.featureflag.entity.WhiteList;
import com.featureflag.enums.Environment;
import com.featureflag.enums.FeatureFlagStatus;
import com.featureflag.repository.FeatureFlagRepository;
import com.featureflag.repository.GrayBatchRepository;
import com.featureflag.repository.WhiteListRepository;
import com.featureflag.engine.RuleEvaluator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeatureFlagEvaluationServiceTest {

    @Mock
    private FeatureFlagRepository featureFlagRepository;

    @Mock
    private WhiteListRepository whiteListRepository;

    @Mock
    private GrayBatchRepository grayBatchRepository;

    @Mock
    private RuleEvaluator ruleEvaluator;

    @InjectMocks
    private FeatureFlagEvaluationService evaluationService;

    private FeatureFlag offFlag;
    private FeatureFlag onFlag;

    @BeforeEach
    void setUp() {
        offFlag = new FeatureFlag();
        offFlag.setId(1L);
        offFlag.setFlagKey("test-flag-off");
        offFlag.setApplication("test-app");
        offFlag.setEnvironment(Environment.PRODUCTION);
        offFlag.setStatus(FeatureFlagStatus.OFF);
        offFlag.setDefaultValue(false);
        offFlag.setRules(new ArrayList<>());
        offFlag.setGrayBatches(new ArrayList<>());
        offFlag.setWhiteLists(new ArrayList<>());

        onFlag = new FeatureFlag();
        onFlag.setId(2L);
        onFlag.setFlagKey("test-flag-on");
        onFlag.setApplication("test-app");
        onFlag.setEnvironment(Environment.PRODUCTION);
        onFlag.setStatus(FeatureFlagStatus.ON);
        onFlag.setDefaultValue(false);
        onFlag.setRules(new ArrayList<>());
        onFlag.setGrayBatches(new ArrayList<>());
        onFlag.setWhiteLists(new ArrayList<>());
    }

    // ── R1 Bug: OFF flag + whitelist user must return WHITELIST_MATCH (not FLAG_DISABLED) ──

    @Test
    @DisplayName("OFF flag + whitelist userId → WHITELIST_MATCH, enabled=true (R1 bug fix)")
    void evaluate_offFlag_whitelistedUser_returnsWhitelistMatch() {
        // given: OFF flag exists
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-off"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(offFlag));

        // given: user is in whitelist
        WhiteList wl = new WhiteList();
        wl.setUserId("whitelist-user-001");
        when(whiteListRepository.findMatchingWhiteList(eq(1L), eq("whitelist-user-001"), any()))
                .thenReturn(List.of(wl));

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-off");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        UserContext ctx = new UserContext();
        ctx.setUserId("whitelist-user-001");
        request.setUserContext(ctx);

        // when
        FlagEvaluationResponse response = evaluationService.evaluate(request);

        // then: whitelist takes priority over OFF status
        assertTrue(response.getEnabled(), "Whitelisted user should get enabled=true even on OFF flag");
        assertEquals("WHITELIST_MATCH", response.getReason(), "Reason must be WHITELIST_MATCH, not FLAG_DISABLED");
    }

    @Test
    @DisplayName("OFF flag + whitelist userTag → WHITELIST_MATCH, enabled=true (R1 bug fix)")
    void evaluate_offFlag_whitelistedTag_returnsWhitelistMatch() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-off"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(offFlag));

        WhiteList wl = new WhiteList();
        wl.setUserTag("vip");
        when(whiteListRepository.findMatchingWhiteList(eq(1L), isNull(), eq(List.of("vip"))))
                .thenReturn(List.of(wl));

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-off");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        UserContext ctx = new UserContext();
        ctx.setUserId(null);
        ctx.setUserTags(List.of("vip"));
        request.setUserContext(ctx);

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertTrue(response.getEnabled());
        assertEquals("WHITELIST_MATCH", response.getReason());
    }

    // ── OFF flag + non-whitelist → must still return FLAG_DISABLED ──

    @Test
    @DisplayName("OFF flag + non-whitelist user → FLAG_DISABLED, enabled=false")
    void evaluate_offFlag_nonWhitelistedUser_returnsFlagDisabled() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-off"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(offFlag));

        when(whiteListRepository.findMatchingWhiteList(eq(1L), eq("nobody"), any()))
                .thenReturn(Collections.emptyList());

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-off");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        UserContext ctx = new UserContext();
        ctx.setUserId("nobody");
        request.setUserContext(ctx);

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertFalse(response.getEnabled());
        assertEquals("FLAG_DISABLED", response.getReason());
    }

    // ── ON flag + whitelist → WHITELIST_MATCH (whitelist still wins) ──

    @Test
    @DisplayName("ON flag + whitelist userId → WHITELIST_MATCH, enabled=true")
    void evaluate_onFlag_whitelistedUser_returnsWhitelistMatch() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-on"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(onFlag));

        WhiteList wl = new WhiteList();
        wl.setUserId("whitelist-user-002");
        when(whiteListRepository.findMatchingWhiteList(eq(2L), eq("whitelist-user-002"), any()))
                .thenReturn(List.of(wl));

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-on");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        UserContext ctx = new UserContext();
        ctx.setUserId("whitelist-user-002");
        request.setUserContext(ctx);

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertTrue(response.getEnabled());
        assertEquals("WHITELIST_MATCH", response.getReason());
    }

    // ── ON flag + non-whitelist + no rules → FLAG_ENABLED_NO_RULES ──

    @Test
    @DisplayName("ON flag + non-whitelist user + no rules → FLAG_ENABLED_NO_RULES")
    void evaluate_onFlag_noRules_returnsFlagEnabledNoRules() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-on"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(onFlag));

        when(whiteListRepository.findMatchingWhiteList(eq(2L), eq("regular-user"), any()))
                .thenReturn(Collections.emptyList());

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-on");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        UserContext ctx = new UserContext();
        ctx.setUserId("regular-user");
        request.setUserContext(ctx);

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertTrue(response.getEnabled());
        assertEquals("FLAG_ENABLED_NO_RULES", response.getReason());
    }

    // ── Flag not found → default fallback ──

    @Test
    @DisplayName("Flag not found → default value false, reason FLAG_NOT_FOUND")
    void evaluate_flagNotFound_returnsNotFound() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("non-existent"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.empty());

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("non-existent");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        request.setDefaultValue(false);

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertFalse(response.getEnabled());
        assertEquals("FLAG_NOT_FOUND", response.getReason());
    }

    // ── Null user context → no whitelist match, proceeds to normal flow ──

    @Test
    @DisplayName("ON flag + null userContext → FLAG_ENABLED_NO_RULES (no whitelist crash)")
    void evaluate_nullUserContext_doesNotCrash() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-on"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(onFlag));

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-on");
        request.setApplication("test-app");
        request.setEnvironment("PRODUCTION");
        // userContext is null

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertTrue(response.getEnabled());
        assertEquals("FLAG_ENABLED_NO_RULES", response.getReason());
    }

    // ── Environment defaulting ──

    @Test
    @DisplayName("Missing environment → defaults to PRODUCTION")
    void evaluate_missingEnvironment_defaultsToProduction() {
        when(featureFlagRepository.findByFlagKeyAndApplicationAndEnvironment(
                eq("test-flag-off"), eq("test-app"), eq(Environment.PRODUCTION)))
                .thenReturn(Optional.of(offFlag));

        when(whiteListRepository.findMatchingWhiteList(eq(1L), eq("user-x"), any()))
                .thenReturn(Collections.emptyList());

        FlagEvaluationRequest request = new FlagEvaluationRequest();
        request.setFlagKey("test-flag-off");
        request.setApplication("test-app");
        // environment is null
        UserContext ctx = new UserContext();
        ctx.setUserId("user-x");
        request.setUserContext(ctx);

        FlagEvaluationResponse response = evaluationService.evaluate(request);

        assertFalse(response.getEnabled());
        assertEquals("FLAG_DISABLED", response.getReason());
    }
}