package com.example.meetingroom.repository;

import com.example.meetingroom.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long>, JpaSpecificationExecutor<Reservation> {

    List<Reservation> findByRoomId(Long roomId);

    List<Reservation> findByRoomIdAndStatusIn(Long roomId, List<Integer> statuses);

    @Query("SELECT r FROM Reservation r WHERE r.roomId = :roomId " +
           "AND r.status IN (0, 1) " +
           "AND r.startTime < :endTime " +
           "AND r.endTime > :startTime " +
           "AND (:excludeId IS NULL OR r.id != :excludeId)")
    List<Reservation> findConflictingReservations(@Param("roomId") Long roomId,
                                                   @Param("startTime") LocalDateTime startTime,
                                                   @Param("endTime") LocalDateTime endTime,
                                                   @Param("excludeId") Long excludeId);

    @Query("SELECT r FROM Reservation r WHERE r.roomId IN :roomIds " +
           "AND r.status IN (0, 1) " +
           "AND r.startTime < :endTime " +
           "AND r.endTime > :startTime")
    List<Reservation> findConflictingReservationsForRooms(@Param("roomIds") List<Long> roomIds,
                                                          @Param("startTime") LocalDateTime startTime,
                                                          @Param("endTime") LocalDateTime endTime);

    default List<Reservation> findConflictingReservations(Long roomId, LocalDateTime startTime, LocalDateTime endTime) {
        return findConflictingReservations(roomId, startTime, endTime, null);
    }

    List<Reservation> findByStatus(Integer status);

    @Query("SELECT r FROM Reservation r WHERE r.status IN (0, 1) " +
           "AND r.startTime <= :now " +
           "AND r.endTime >= :now")
    List<Reservation> findActiveReservations(@Param("now") LocalDateTime now);

    @Query("SELECT r FROM Reservation r WHERE r.status = 1 " +
           "AND r.endTime < :now " +
           "AND r.status != 3")
    List<Reservation> findReservationsToComplete(@Param("now") LocalDateTime now);
}
