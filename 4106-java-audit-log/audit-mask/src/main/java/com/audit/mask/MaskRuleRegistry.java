package com.audit.mask;

import com.audit.common.enums.MaskStrategy;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class MaskRuleRegistry {

    private final MaskRuleConfig maskRuleConfig;
    private final Map<String, MaskRule> ruleMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        initDefaultRules();
        overlayConfigRules();
    }

    private void initDefaultRules() {
        addRule("ID_CARD", MaskRule.builder()
                .fieldName("idCard")
                .strategy(MaskStrategy.ID_CARD)
                .keepPrefix(3)
                .keepSuffix(4)
                .replaceChar('*')
                .enabled(true)
                .build());
        addRule("BANK_CARD", MaskRule.builder()
                .fieldName("bankCard")
                .strategy(MaskStrategy.BANK_CARD)
                .keepPrefix(4)
                .keepSuffix(4)
                .replaceChar('*')
                .enabled(true)
                .build());
        addRule("PHONE", MaskRule.builder()
                .fieldName("phone")
                .strategy(MaskStrategy.PHONE)
                .keepPrefix(3)
                .keepSuffix(4)
                .replaceChar('*')
                .enabled(true)
                .build());
        addRule("PASSWORD", MaskRule.builder()
                .fieldName("password")
                .strategy(MaskStrategy.PASSWORD)
                .replaceChar('*')
                .enabled(true)
                .build());
        addRule("EMAIL", MaskRule.builder()
                .fieldName("email")
                .strategy(MaskStrategy.EMAIL)
                .replaceChar('*')
                .enabled(true)
                .build());
        addRule("NAME", MaskRule.builder()
                .fieldName("name")
                .strategy(MaskStrategy.NAME)
                .replaceChar('*')
                .enabled(true)
                .build());
    }

    private void overlayConfigRules() {
        if (maskRuleConfig != null && maskRuleConfig.getRules() != null) {
            maskRuleConfig.getRules().forEach(this::addRule);
        }
    }

    public void addRule(String ruleName, MaskRule rule) {
        ruleMap.put(ruleName, rule);
    }

    public MaskRule getRule(String ruleName) {
        return ruleMap.get(ruleName);
    }

    public MaskRule getRuleByFieldName(String fieldName) {
        return ruleMap.values().stream()
                .filter(rule -> rule.getFieldName().equals(fieldName) && rule.isEnabled())
                .findFirst()
                .orElse(null);
    }

    public void removeRule(String ruleName) {
        ruleMap.remove(ruleName);
    }

    public Collection<MaskRule> getAllRules() {
        return Collections.unmodifiableCollection(ruleMap.values());
    }
}
