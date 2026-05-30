package com.featureflag.repository;

import com.featureflag.entity.GrayBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrayBatchRepository extends JpaRepository<GrayBatch, Long> {

    List<GrayBatch> findByFeatureFlagIdOrderByBatchOrderAsc(Long featureFlagId);

    List<GrayBatch> findByFeatureFlagId(Long featureFlagId);
}
