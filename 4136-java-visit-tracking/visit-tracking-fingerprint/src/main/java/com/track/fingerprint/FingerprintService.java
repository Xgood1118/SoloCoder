package com.track.fingerprint;

import com.track.common.dto.FingerprintRequest;
import com.track.common.entity.UserFingerprint;
import com.track.common.enums.UserStatus;
import com.track.common.repository.SessionRepository;
import com.track.common.repository.UserFingerprintRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class FingerprintService {

    private final UserFingerprintRepository fingerprintRepository;
    private final SessionRepository sessionRepository;
    private final FingerprintConfidenceCalculator confidenceCalculator;

    public String generateOrMatch(FingerprintRequest request) {
        String hash = computeFingerprintHash(request);
        return fingerprintRepository.findByFingerprintHashAndStatusNot(hash, UserStatus.MERGED)
                .map(UserFingerprint::getFingerprintId)
                .orElseGet(() -> createFingerprint(request, hash));
    }

    private String createFingerprint(FingerprintRequest request, String hash) {
        UserFingerprint fp = new UserFingerprint();
        fp.setFingerprintId(UUID.randomUUID().toString());
        fp.setFingerprintHash(hash);
        fp.setUserAgent(request.getUserAgent());
        fp.setScreenResolution(request.getScreenResolution());
        fp.setTimezone(request.getTimezone());
        fp.setLanguage(request.getLanguage());
        fp.setInstalledFonts(request.getInstalledFonts());
        fp.setStatus(UserStatus.ANONYMOUS);
        fp.setConfidence(confidenceCalculator.calculateConfidence(fp));
        fingerprintRepository.save(fp);
        log.info("Created new fingerprint: {}", fp.getFingerprintId());
        return fp.getFingerprintId();
    }

    public String computeFingerprintHash(FingerprintRequest request) {
        String raw = String.join("|",
                nullToEmpty(request.getUserAgent()),
                nullToEmpty(request.getScreenResolution()),
                nullToEmpty(request.getTimezone()),
                nullToEmpty(request.getLanguage()),
                nullToEmpty(request.getInstalledFonts()));
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                hexString.append(String.format("%02x", b));
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute fingerprint hash", e);
        }
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public void linkToSession(String fingerprintId, String sessionId) {
        fingerprintRepository.findByFingerprintId(fingerprintId).ifPresent(fp -> {
            sessionRepository.findBySessionId(sessionId).ifPresent(session -> {
                session.setFingerprintId(fp.getFingerprintId());
                sessionRepository.save(session);
                log.info("Linked fingerprint {} to session {}", fingerprintId, sessionId);
            });
        });
    }

    public void upgradeToIdentified(String fingerprintId, String userId) {
        fingerprintRepository.findByFingerprintId(fingerprintId).ifPresent(fp -> {
            fp.setStatus(UserStatus.IDENTIFIED);
            fp.setUserId(userId);
            fingerprintRepository.save(fp);
            log.info("Upgraded fingerprint {} to IDENTIFIED with userId={}", fingerprintId, userId);
        });
    }
}
