package com.example.meetingroom.controller;

import com.example.meetingroom.dto.AvailableRoomQueryDTO;
import com.example.meetingroom.dto.MeetingRoomDTO;
import com.example.meetingroom.dto.MeetingRoomQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.common.Result;
import com.example.meetingroom.service.MeetingRoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/meeting-rooms")
@RequiredArgsConstructor
public class MeetingRoomController {

    private final MeetingRoomService meetingRoomService;

    @PostMapping
    public Result<MeetingRoomDTO> create(@Valid @RequestBody MeetingRoomDTO dto) {
        return Result.success(meetingRoomService.create(dto));
    }

    @PutMapping("/{id}")
    public Result<MeetingRoomDTO> update(@PathVariable Long id, @Valid @RequestBody MeetingRoomDTO dto) {
        return Result.success(meetingRoomService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        meetingRoomService.delete(id);
        return Result.success();
    }

    @GetMapping("/{id}")
    public Result<MeetingRoomDTO> getById(@PathVariable Long id) {
        return Result.success(meetingRoomService.getById(id));
    }

    @GetMapping("/list")
    public Result<PageResult<MeetingRoomDTO>> list(MeetingRoomQueryDTO query) {
        return Result.success(meetingRoomService.list(query));
    }

    @GetMapping("/all")
    public Result<List<MeetingRoomDTO>> getAllActiveRooms() {
        return Result.success(meetingRoomService.getAllActiveRooms());
    }

    @GetMapping("/available")
    public Result<List<MeetingRoomDTO>> findAvailableRooms(
            @RequestParam LocalDateTime startTime,
            @RequestParam LocalDateTime endTime) {
        return Result.success(meetingRoomService.findAvailableRooms(startTime, endTime));
    }

    @PostMapping("/available/filter")
    public Result<List<MeetingRoomDTO>> findAvailableRoomsWithFilter(
            @Valid @RequestBody AvailableRoomQueryDTO query) {
        return Result.success(meetingRoomService.findAvailableRoomsWithFilter(query));
    }
}
