package com.featureflag.repository;

import com.featureflag.entity.FlagChangeEvent;
import com.featureflag.enums.Environment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FlagChangeEventRepository extends JpaRepository<FlagChangeEvent, Long> {

    @Query("SELECT e FROM FlagChangeEvent e WHERE e.application = :application AND e.createdAt > :since ORDER BY e.createdAt DESC")
    List<FlagChangeEvent> findEventsSince(@Param("application") String application, @Param("since") LocalDateTime since);

    List<FlagChangeEvent> findByFlagKeyAndApplicationOrderByCreatedAtDesc(String flagKey, String application);
}
