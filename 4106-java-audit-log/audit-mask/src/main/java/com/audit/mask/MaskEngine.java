package com.audit.mask;

import com.audit.common.enums.MaskStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MaskEngine {

    private final MaskRuleRegistry maskRuleRegistry;

    public String mask(String fieldName, String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        MaskRule rule = maskRuleRegistry.getRuleByFieldName(fieldName);
        if (rule == null || !rule.isEnabled()) {
            return value;
        }
        return applyMask(rule, value);
    }

    public Map<String, String> maskMap(Map<String, String> data) {
        if (data == null || data.isEmpty()) {
            return data;
        }
        Map<String, String> result = new LinkedHashMap<>(data.size());
        data.forEach((key, val) -> result.put(key, mask(key, val)));
        return result;
    }

    private String applyMask(MaskRule rule, String value) {
        return switch (rule.getStrategy()) {
            case PASSWORD -> maskFull(value, rule.getReplaceChar());
            case EMAIL -> maskEmail(value, rule.getReplaceChar());
            case NAME -> maskName(value, rule.getReplaceChar());
            case ID_CARD, BANK_CARD, PHONE, CUSTOM -> maskGeneric(value, rule.getKeepPrefix(), rule.getKeepSuffix(), rule.getReplaceChar());
        };
    }

    private String maskGeneric(String value, int keepPrefix, int keepSuffix, char replaceChar) {
        int len = value.length();
        int keepTotal = keepPrefix + keepSuffix;
        if (keepTotal >= len) {
            return value;
        }
        StringBuilder sb = new StringBuilder(len);
        sb.append(value, 0, keepPrefix);
        for (int i = 0; i < len - keepTotal; i++) {
            sb.append(replaceChar);
        }
        sb.append(value, len - keepSuffix, len);
        return sb.toString();
    }

    private String maskFull(String value, char replaceChar) {
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            sb.append(replaceChar);
        }
        return sb.toString();
    }

    private String maskEmail(String value, char replaceChar) {
        int atIndex = value.indexOf('@');
        if (atIndex <= 0) {
            return maskFull(value, replaceChar);
        }
        String localPart = value.substring(0, atIndex);
        String domain = value.substring(atIndex);
        StringBuilder sb = new StringBuilder();
        sb.append(localPart.charAt(0));
        for (int i = 1; i < localPart.length(); i++) {
            sb.append(replaceChar);
        }
        sb.append(domain);
        return sb.toString();
    }

    private String maskName(String value, char replaceChar) {
        if (value.isEmpty()) {
            return value;
        }
        StringBuilder sb = new StringBuilder(value.length());
        sb.append(value.charAt(0));
        for (int i = 1; i < value.length(); i++) {
            sb.append(replaceChar);
        }
        return sb.toString();
    }
}
