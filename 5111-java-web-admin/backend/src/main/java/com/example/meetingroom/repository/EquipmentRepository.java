package com.example.meetingroom.repository;

import com.example.meetingroom.entity.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Long>, JpaSpecificationExecutor<Equipment> {

    Optional<Equipment> findByEquipmentCode(String equipmentCode);

    boolean existsByEquipmentCode(String equipmentCode);

    List<Equipment> findByRoomId(Long roomId);

    List<Equipment> findByRoomIdIsNull();

    List<Equipment> findByRoomIdAndStatus(Long roomId, Integer status);

    List<Equipment> findByStatus(Integer status);

    @Modifying
    @Query("UPDATE Equipment e SET e.locked = :locked WHERE e.id IN :ids")
    int updateLockedStatus(@Param("ids") List<Long> ids, @Param("locked") Boolean locked);

    @Modifying
    @Query("UPDATE Equipment e SET e.roomId = NULL WHERE e.roomId = :roomId")
    int unbindAllEquipmentFromRoom(@Param("roomId") Long roomId);

    @Query("SELECT e FROM Equipment e WHERE e.roomId = :roomId AND e.status = 1 AND e.locked = true")
    List<Equipment> findLockedEquipmentByRoomId(@Param("roomId") Long roomId);

    @Query("SELECT COUNT(e) > 0 FROM Equipment e WHERE e.id IN :ids AND e.locked = true")
    boolean existsLockedEquipment(@Param("ids") List<Long> ids);
}
