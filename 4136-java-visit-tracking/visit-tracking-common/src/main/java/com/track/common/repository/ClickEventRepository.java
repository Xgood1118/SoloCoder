package com.track.common.repository;

import com.track.common.entity.ClickEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ClickEventRepository extends JpaRepository<ClickEvent, Long> {

    List<ClickEvent> findByFingerprintId(String fingerprintId);

    List<ClickEvent> findByPageUrl(String pageUrl);

    List<ClickEvent> findByPageUrlAndTimestampBetween(String pageUrl, LocalDateTime start, LocalDateTime end);
}
