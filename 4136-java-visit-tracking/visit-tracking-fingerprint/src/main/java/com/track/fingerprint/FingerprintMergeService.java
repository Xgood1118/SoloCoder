package com.track.fingerprint;

import com.track.common.entity.ClickEvent;
import com.track.common.entity.UserFingerprint;
import com.track.common.entity.VisitEvent;
import com.track.common.enums.UserStatus;
import com.track.common.repository.ClickEventRepository;
import com.track.common.repository.UserFingerprintRepository;
import com.track.common.repository.VisitEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class FingerprintMergeService {

    private static final double HIGH_CONFIDENCE_THRESHOLD = 0.8;
    private static final double MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

    private final UserFingerprintRepository fingerprintRepository;
    private final VisitEventRepository visitEventRepository;
    private final ClickEventRepository clickEventRepository;
    private final FingerprintConfidenceCalculator confidenceCalculator;

    @Transactional
    public void checkAndMerge(String fingerprintId) {
        Optional<UserFingerprint> currentOpt = fingerprintRepository.findByFingerprintId(fingerprintId);
        if (currentOpt.isEmpty()) {
            log.warn("Fingerprint not found: {}", fingerprintId);
            return;
        }

        UserFingerprint current = currentOpt.get();
        List<UserFingerprint> candidates = fingerprintRepository
                .findByFingerprintHashAndStatusNotIn(current.getFingerprintHash(),
                        Collections.singletonList(UserStatus.MERGED));

        List<UserFingerprint> others = candidates.stream()
                .filter(fp -> !fp.getFingerprintId().equals(fingerprintId))
                .toList();

        if (others.isEmpty()) {
            return;
        }

        double confidence = confidenceCalculator.calculateConfidence(current);

        if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
            for (UserFingerprint other : others) {
                if (other.getStatus() == UserStatus.ANONYMOUS && current.getStatus() == UserStatus.ANONYMOUS) {
                    UserFingerprint older = current.getCreatedAt().isBefore(other.getCreatedAt()) ? current : other;
                    UserFingerprint newer = current.getCreatedAt().isBefore(other.getCreatedAt()) ? other : current;
                    performMerge(newer, older);
                }
            }
        } else if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
            log.info("Medium confidence ({}) for fingerprint {}, logging for manual review. Matching fingerprints: {}",
                    confidence, fingerprintId, others.stream().map(UserFingerprint::getFingerprintId).toList());
        } else {
            log.warn("Low confidence ({}) for fingerprint {}, skipping merge", confidence, fingerprintId);
        }
    }

    @Transactional
    public void mergeFingerprints(String sourceId, String targetId) {
        Optional<UserFingerprint> sourceOpt = fingerprintRepository.findByFingerprintId(sourceId);
        Optional<UserFingerprint> targetOpt = fingerprintRepository.findByFingerprintId(targetId);

        if (sourceOpt.isEmpty() || targetOpt.isEmpty()) {
            log.warn("Source or target fingerprint not found: source={}, target={}", sourceId, targetId);
            return;
        }

        UserFingerprint source = sourceOpt.get();
        UserFingerprint target = targetOpt.get();

        if (source.getStatus() == UserStatus.MERGED) {
            log.warn("Source fingerprint {} is already merged", sourceId);
            return;
        }

        performMerge(source, target);
    }

    private void performMerge(UserFingerprint newer, UserFingerprint older) {
        newer.setMergedIntoId(older.getFingerprintId());
        newer.setStatus(UserStatus.MERGED);
        fingerprintRepository.save(newer);

        reassignEvents(newer.getFingerprintId(), older.getFingerprintId());
        fingerprintRepository.save(older);

        log.info("Merged fingerprint {} into {}", newer.getFingerprintId(), older.getFingerprintId());
    }

    private void reassignEvents(String sourceFingerprintId, String targetFingerprintId) {
        List<VisitEvent> visitEvents = visitEventRepository.findByFingerprintId(sourceFingerprintId);
        visitEvents.forEach(event -> event.setFingerprintId(targetFingerprintId));
        visitEventRepository.saveAll(visitEvents);

        List<ClickEvent> clickEvents = clickEventRepository.findByFingerprintId(sourceFingerprintId);
        clickEvents.forEach(event -> event.setFingerprintId(targetFingerprintId));
        clickEventRepository.saveAll(clickEvents);
    }
}
