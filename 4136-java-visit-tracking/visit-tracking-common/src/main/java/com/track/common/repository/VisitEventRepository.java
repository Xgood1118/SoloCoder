package com.track.common.repository;

import com.track.common.entity.VisitEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VisitEventRepository extends JpaRepository<VisitEvent, Long> {

    List<VisitEvent> findByFingerprintId(String fingerprintId);

    List<VisitEvent> findBySessionIdOrderByTimestampAsc(String sessionId);

    List<String> findDistinctSessionIdsByPageUrl(String pageUrl);

    long countByPageUrl(String pageUrl);
}
