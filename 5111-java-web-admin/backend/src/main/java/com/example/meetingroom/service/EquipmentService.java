package com.example.meetingroom.service;

import com.example.meetingroom.dto.EquipmentDTO;
import com.example.meetingroom.dto.EquipmentQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.Equipment;

import java.time.LocalDateTime;
import java.util.List;

public interface EquipmentService {

    EquipmentDTO create(EquipmentDTO dto);

    EquipmentDTO update(Long id, EquipmentDTO dto);

    void delete(Long id);

    EquipmentDTO getById(Long id);

    PageResult<EquipmentDTO> list(EquipmentQueryDTO query);

    EquipmentDTO bindToRoom(Long equipmentId, Long roomId);

    EquipmentDTO unbindFromRoom(Long equipmentId);

    void unbindAllFromRoom(Long roomId);

    List<EquipmentDTO> findByRoomId(Long roomId);

    List<EquipmentDTO> findUnboundEquipment();

    List<Equipment> findActiveEquipmentByRoomId(Long roomId);

    Equipment getEntityById(Long id);

    void lockEquipment(Long equipmentId, Long reservationId, Long roomId,
                       LocalDateTime startTime, LocalDateTime endTime, String operator, String operatorIp);

    void unlockEquipment(Long equipmentId, Long reservationId, Long roomId,
                         LocalDateTime startTime, LocalDateTime endTime, String operator, String operatorIp);

    void forceUnlockEquipment(Long equipmentId, String operator, String operatorIp);

    void lockEquipmentList(List<Long> equipmentIds, Long reservationId, Long roomId,
                           LocalDateTime startTime, LocalDateTime endTime, String operator, String operatorIp);

    void unlockEquipmentList(List<Long> equipmentIds, Long reservationId, Long roomId,
                             LocalDateTime startTime, LocalDateTime endTime, String operator, String operatorIp);
}
