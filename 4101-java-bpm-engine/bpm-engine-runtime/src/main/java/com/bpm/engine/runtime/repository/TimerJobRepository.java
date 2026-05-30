package com.bpm.engine.runtime.repository;

import com.bpm.engine.runtime.entity.TimerJobEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TimerJobRepository extends JpaRepository<TimerJobEntity, String> {

    List<TimerJobEntity> findByProcessInstanceId(String processInstanceId);

    @Query("SELECT t FROM TimerJobEntity t WHERE t.duedate <= :now AND t.isSuspended = false AND t.lockOwner IS NULL")
    List<TimerJobEntity> findByDuedateBeforeAndIsSuspended(@Param("now") LocalDateTime now);

    List<TimerJobEntity> findByLockOwner(String lockOwner);
}
