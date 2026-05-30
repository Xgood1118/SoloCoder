package com.featureflag.repository;

import com.featureflag.entity.FeatureFlag;
import com.featureflag.enums.Environment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FeatureFlagRepository extends JpaRepository<FeatureFlag, Long> {

    Optional<FeatureFlag> findByFlagKeyAndApplicationAndEnvironment(String flagKey, String application, Environment environment);

    List<FeatureFlag> findByApplicationAndEnvironment(String application, Environment environment);

    List<FeatureFlag> findByApplication(String application);

    List<FeatureFlag> findByGroupName(String groupName);

    @Query("SELECT f FROM FeatureFlag f WHERE f.application = :application AND f.environment = :environment AND f.updatedAt > :since")
    List<FeatureFlag> findChangedFlags(@Param("application") String application,
                                       @Param("environment") Environment environment,
                                       @Param("since") java.time.LocalDateTime since);

    boolean existsByFlagKeyAndApplicationAndEnvironment(String flagKey, String application, Environment environment);
}
