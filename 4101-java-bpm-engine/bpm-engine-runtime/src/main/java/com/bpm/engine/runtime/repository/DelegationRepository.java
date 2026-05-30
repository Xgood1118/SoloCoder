package com.bpm.engine.runtime.repository;

import com.bpm.engine.runtime.entity.DelegationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DelegationRepository extends JpaRepository<DelegationEntity, String> {

    List<DelegationEntity> findByDelegatorIdAndIsEnabled(String delegatorId, boolean isEnabled);

    List<DelegationEntity> findByDelegateUserIdAndIsEnabled(String delegateUserId, boolean isEnabled);

    @Query("SELECT d FROM DelegationEntity d WHERE d.delegatorId = :delegatorId " +
            "AND d.isEnabled = true " +
            "AND d.effectiveTime <= :now " +
            "AND d.expiryTime >= :now")
    List<DelegationEntity> findActiveDelegations(@Param("delegatorId") String delegatorId, @Param("now") LocalDateTime now);
}
