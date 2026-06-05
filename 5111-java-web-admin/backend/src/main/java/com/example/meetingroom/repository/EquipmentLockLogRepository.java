package com.example.meetingroom.repository;

import com.example.meetingroom.entity.EquipmentLockLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EquipmentLockLogRepository extends JpaRepository<EquipmentLockLog, Long>, JpaSpecificationExecutor<EquipmentLockLog> {

    List<EquipmentLockLog> findByEquipmentIdOrderByCreatedAtDesc(Long equipmentId);

    List<EquipmentLockLog> findByReservationId(Long reservationId);

    List<EquipmentLockLog> findByLockType(String lockType);

    @Query("SELECT ell FROM EquipmentLockLog ell WHERE ell.equipmentId = :equipmentId " +
           "AND ell.lockType = 'LOCK' " +
           "AND ell.startTime <= :now " +
           "AND ell.endTime >= :now " +
           "ORDER BY ell.createdAt DESC " +
           "LIMIT 1")
    EquipmentLockLog findCurrentLockLog(@Param("equipmentId") Long equipmentId, @Param("now") LocalDateTime now);

    @Query("SELECT ell FROM EquipmentLockLog ell WHERE ell.reservationId = :reservationId " +
           "AND ell.lockType = 'LOCK'")
    List<EquipmentLockLog> findLockLogsByReservationId(@Param("reservationId") Long reservationId);
}
