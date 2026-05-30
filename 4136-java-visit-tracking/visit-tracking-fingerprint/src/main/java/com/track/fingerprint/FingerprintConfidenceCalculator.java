package com.track.fingerprint;

import com.track.common.entity.UserFingerprint;
import org.springframework.stereotype.Component;

@Component
public class FingerprintConfidenceCalculator {

    private static final double WEIGHT_USER_AGENT = 0.3;
    private static final double WEIGHT_SCREEN_RESOLUTION = 0.2;
    private static final double WEIGHT_TIMEZONE = 0.15;
    private static final double WEIGHT_LANGUAGE = 0.15;
    private static final double WEIGHT_INSTALLED_FONTS = 0.2;

    public double calculateConfidence(UserFingerprint fp) {
        double score = 0.0;
        if (isPresent(fp.getUserAgent())) {
            score += WEIGHT_USER_AGENT;
        }
        if (isPresent(fp.getScreenResolution())) {
            score += WEIGHT_SCREEN_RESOLUTION;
        }
        if (isPresent(fp.getTimezone())) {
            score += WEIGHT_TIMEZONE;
        }
        if (isPresent(fp.getLanguage())) {
            score += WEIGHT_LANGUAGE;
        }
        if (isPresent(fp.getInstalledFonts())) {
            score += WEIGHT_INSTALLED_FONTS;
        }
        return score;
    }

    private boolean isPresent(String value) {
        return value != null && !value.isEmpty();
    }
}
