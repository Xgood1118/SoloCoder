package com.featureflag.engine;

import com.featureflag.entity.FeatureRule;
import com.featureflag.entity.RuleCondition;
import com.featureflag.enums.LogicOperator;
import com.featureflag.enums.RuleType;
import com.featureflag.dto.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class RuleEvaluator {

    private final PercentageCalculator percentageCalculator;
    private final ConditionMatcher conditionMatcher;

    public boolean evaluateRule(FeatureRule rule, UserContext userContext, String flagKey) {
        if (rule == null || !rule.getEnabled()) {
            return false;
        }

        RuleType ruleType = rule.getRuleType();

        switch (ruleType) {
            case PERCENTAGE:
                return evaluatePercentageRule(rule, userContext, flagKey);
            case CONDITION:
                return evaluateConditionRule(rule, userContext);
            default:
                return false;
        }
    }

    private boolean evaluatePercentageRule(FeatureRule rule, UserContext userContext, String flagKey) {
        if (userContext == null || userContext.getUserId() == null) {
            return false;
        }
        Integer percentage = rule.getPercentage();
        if (percentage == null) {
            return false;
        }
        return percentageCalculator.isInPercentage(userContext.getUserId(), flagKey, percentage);
    }

    private boolean evaluateConditionRule(FeatureRule rule, UserContext userContext) {
        List<RuleCondition> conditions = rule.getConditions();
        if (conditions == null || conditions.isEmpty()) {
            return true;
        }

        LogicOperator logicOperator = rule.getLogicOperator();
        if (logicOperator == null) {
            logicOperator = LogicOperator.AND;
        }

        if (logicOperator == LogicOperator.AND) {
            for (RuleCondition condition : conditions) {
                if (!conditionMatcher.matchCondition(condition, userContext)) {
                    return false;
                }
            }
            return true;
        } else {
            for (RuleCondition condition : conditions) {
                if (conditionMatcher.matchCondition(condition, userContext)) {
                    return true;
                }
            }
            return false;
        }
    }
}
