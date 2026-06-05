package com.example.meetingroom.controller;

import com.example.meetingroom.dto.*;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.common.Result;
import com.example.meetingroom.service.ReservationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationService reservationService;

    @PostMapping
    public Result<ReservationDTO> create(@Valid @RequestBody ReservationDTO dto,
                                         HttpServletRequest request) {
        String operatorIp = request.getRemoteAddr();
        return Result.success(reservationService.create(dto, operatorIp));
    }

    @PutMapping("/{id}")
    public Result<ReservationDTO> update(@PathVariable Long id,
                                         @Valid @RequestBody ReservationDTO dto,
                                         HttpServletRequest request) {
        String operatorIp = request.getRemoteAddr();
        return Result.success(reservationService.update(id, dto, operatorIp));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id,
                               @RequestParam String operator,
                               HttpServletRequest request) {
        String operatorIp = request.getRemoteAddr();
        reservationService.delete(id, operator, operatorIp);
        return Result.success();
    }

    @GetMapping("/{id}")
    public Result<ReservationDTO> getById(@PathVariable Long id) {
        return Result.success(reservationService.getById(id));
    }

    @GetMapping("/list")
    public Result<PageResult<ReservationDTO>> list(ReservationQueryDTO query) {
        return Result.success(reservationService.list(query));
    }

    @PostMapping("/check-conflict")
    public Result<ConflictResultDTO> checkConflict(@Valid @RequestBody ConflictCheckDTO dto) {
        return Result.success(reservationService.checkConflict(dto));
    }

    @PostMapping("/{id}/cancel")
    public Result<ReservationDTO> cancel(@PathVariable Long id,
                                         @RequestParam String operator,
                                         HttpServletRequest request) {
        String operatorIp = request.getRemoteAddr();
        return Result.success(reservationService.cancel(id, operator, operatorIp));
    }

    @PostMapping("/batch")
    public Result<BatchReservationResultDTO> batchCreate(@Valid @RequestBody BatchReservationDTO dto,
                                                          HttpServletRequest request) {
        String operatorIp = request.getRemoteAddr();
        return Result.success(reservationService.batchCreate(dto, operatorIp));
    }
}
