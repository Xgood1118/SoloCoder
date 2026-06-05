package com.example.meetingroom.service;

import com.example.meetingroom.dto.EquipmentLockLogQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.EquipmentLockLog;

import java.util.List;

public interface EquipmentLockLogService {

    PageResult<EquipmentLockLog> list(EquipmentLockLogQueryDTO query);

    List<EquipmentLockLog> findByEquipmentId(Long equipmentId);

    List<EquipmentLockLog> findByReservationId(Long reservationId);
}
