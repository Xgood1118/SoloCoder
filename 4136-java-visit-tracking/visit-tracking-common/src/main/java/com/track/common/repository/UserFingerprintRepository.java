package com.track.common.repository;

import com.track.common.entity.UserFingerprint;
import com.track.common.enums.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserFingerprintRepository extends JpaRepository<UserFingerprint, Long> {

    Optional<UserFingerprint> findByFingerprintId(String fingerprintId);

    Optional<UserFingerprint> findByFingerprintHashAndStatusNot(String fingerprintHash, UserStatus status);

    List<UserFingerprint> findByFingerprintHashAndStatusNotIn(String fingerprintHash, List<UserStatus> excludedStatuses);

    List<UserFingerprint> findByFingerprintHash(String fingerprintHash);
}
