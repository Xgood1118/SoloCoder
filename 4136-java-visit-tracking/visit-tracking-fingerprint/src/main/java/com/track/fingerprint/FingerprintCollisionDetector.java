package com.track.fingerprint;

import com.track.common.entity.UserFingerprint;
import com.track.common.enums.UserStatus;
import com.track.common.repository.UserFingerprintRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class FingerprintCollisionDetector {

    private final UserFingerprintRepository fingerprintRepository;

    public List<String> detectCollision(String fingerprintHash) {
        List<UserFingerprint> activeFingerprints = fingerprintRepository
                .findByFingerprintHashAndStatusNotIn(fingerprintHash,
                        Collections.singletonList(UserStatus.MERGED));

        if (activeFingerprints.size() > 1) {
            List<String> collidingIds = activeFingerprints.stream()
                    .map(UserFingerprint::getFingerprintId)
                    .toList();
            log.warn("Fingerprint collision detected for hash {}: {}", fingerprintHash, collidingIds);
            return collidingIds;
        }

        return Collections.emptyList();
    }
}
