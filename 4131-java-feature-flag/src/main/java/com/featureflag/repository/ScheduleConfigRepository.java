package com.featureflag.repository;

import com.featureflag.entity.ScheduleConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ScheduleConfigRepository extends JpaRepository<ScheduleConfig, Long> {

    List<ScheduleConfig> findByFeatureFlagId(Long featureFlagId);

    @Query("SELECT s FROM ScheduleConfig s WHERE s.enabled = true AND s.executed = false AND s.effectiveTime <= :now")
    List<ScheduleConfig> findScheduledToExecute(@Param("now") LocalDateTime now);

    @Query("SELECT s FROM ScheduleConfig s WHERE s.enabled = true AND s.featureFlag.id = :flagId AND s.effectiveTime <= :now AND (s.expireTime IS NULL OR s.expireTime > :now)")
    List<ScheduleConfig> findActiveSchedules(@Param("flagId") Long flagId, @Param("now") LocalDateTime now);
}
