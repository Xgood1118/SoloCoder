package com.example.meetingroom.controller;

import com.example.meetingroom.dto.EquipmentLockLogQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.common.Result;
import com.example.meetingroom.entity.EquipmentLockLog;
import com.example.meetingroom.service.EquipmentLockLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/equipment-lock-logs")
@RequiredArgsConstructor
public class EquipmentLockLogController {

    private final EquipmentLockLogService equipmentLockLogService;

    @GetMapping("/list")
    public Result<PageResult<EquipmentLockLog>> list(EquipmentLockLogQueryDTO query) {
        return Result.success(equipmentLockLogService.list(query));
    }

    @GetMapping("/equipment/{equipmentId}")
    public Result<List<EquipmentLockLog>> findByEquipmentId(@PathVariable Long equipmentId) {
        return Result.success(equipmentLockLogService.findByEquipmentId(equipmentId));
    }

    @GetMapping("/reservation/{reservationId}")
    public Result<List<EquipmentLockLog>> findByReservationId(@PathVariable Long reservationId) {
        return Result.success(equipmentLockLogService.findByReservationId(reservationId));
    }
}
