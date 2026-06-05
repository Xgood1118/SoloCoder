package com.example.meetingroom.repository;

import com.example.meetingroom.entity.MeetingRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingRoomRepository extends JpaRepository<MeetingRoom, Long>, JpaSpecificationExecutor<MeetingRoom> {

    Optional<MeetingRoom> findByRoomNumber(String roomNumber);

    boolean existsByRoomNumber(String roomNumber);

    List<MeetingRoom> findByStatus(Integer status);

    @Query("SELECT mr FROM MeetingRoom mr WHERE mr.status = 1 " +
           "AND mr.id NOT IN (" +
           "    SELECT r.roomId FROM Reservation r " +
           "    WHERE r.status IN (0, 1) " +
           "    AND r.startTime < :endTime " +
           "    AND r.endTime > :startTime" +
           ")")
    List<MeetingRoom> findAvailableRooms(@Param("startTime") LocalDateTime startTime,
                                         @Param("endTime") LocalDateTime endTime);

    @Query("SELECT mr FROM MeetingRoom mr WHERE mr.status = 1 " +
           "AND (:weekendAvailable IS NULL OR mr.weekendAvailable = :weekendAvailable) " +
           "AND mr.id NOT IN (" +
           "    SELECT r.roomId FROM Reservation r " +
           "    WHERE r.status IN (0, 1) " +
           "    AND r.startTime < :endTime " +
           "    AND r.endTime > :startTime" +
           ")")
    List<MeetingRoom> findAvailableRoomsWithFilter(@Param("startTime") LocalDateTime startTime,
                                                    @Param("endTime") LocalDateTime endTime,
                                                    @Param("weekendAvailable") Boolean weekendAvailable);
}