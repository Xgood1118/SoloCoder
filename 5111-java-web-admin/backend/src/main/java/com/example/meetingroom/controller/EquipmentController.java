package com.example.meetingroom.controller;

import com.example.meetingroom.dto.EquipmentDTO;
import com.example.meetingroom.dto.EquipmentQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.common.Result;
import com.example.meetingroom.service.EquipmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/equipment")
@RequiredArgsConstructor
public class EquipmentController {

    private final EquipmentService equipmentService;

    @PostMapping
    public Result<EquipmentDTO> create(@Valid @RequestBody EquipmentDTO dto) {
        return Result.success(equipmentService.create(dto));
    }

    @PutMapping("/{id}")
    public Result<EquipmentDTO> update(@PathVariable Long id, @Valid @RequestBody EquipmentDTO dto) {
        return Result.success(equipmentService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        equipmentService.delete(id);
        return Result.success();
    }

    @GetMapping("/{id}")
    public Result<EquipmentDTO> getById(@PathVariable Long id) {
        return Result.success(equipmentService.getById(id));
    }

    @GetMapping("/list")
    public Result<PageResult<EquipmentDTO>> list(EquipmentQueryDTO query) {
        return Result.success(equipmentService.list(query));
    }

    @PostMapping("/{equipmentId}/bind/{roomId}")
    public Result<EquipmentDTO> bindToRoom(@PathVariable Long equipmentId, @PathVariable Long roomId) {
        return Result.success(equipmentService.bindToRoom(equipmentId, roomId));
    }

    @PostMapping("/{equipmentId}/unbind")
    public Result<EquipmentDTO> unbindFromRoom(@PathVariable Long equipmentId) {
        return Result.success(equipmentService.unbindFromRoom(equipmentId));
    }

    @GetMapping("/room/{roomId}")
    public Result<List<EquipmentDTO>> findByRoomId(@PathVariable Long roomId) {
        return Result.success(equipmentService.findByRoomId(roomId));
    }

    @GetMapping("/unbound")
    public Result<List<EquipmentDTO>> findUnboundEquipment() {
        return Result.success(equipmentService.findUnboundEquipment());
    }

    @PostMapping("/{equipmentId}/force-unlock")
    public Result<Void> forceUnlockEquipment(@PathVariable Long equipmentId,
                                             @RequestParam String operator,
                                             HttpServletRequest request) {
        String operatorIp = request.getRemoteAddr();
        equipmentService.forceUnlockEquipment(equipmentId, operator, operatorIp);
        return Result.success();
    }
}
