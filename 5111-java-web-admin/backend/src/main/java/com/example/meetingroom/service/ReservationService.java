package com.example.meetingroom.service;

import com.example.meetingroom.dto.*;
import com.example.meetingroom.common.PageResult;

public interface ReservationService {

    ReservationDTO create(ReservationDTO dto, String operatorIp);

    ReservationDTO update(Long id, ReservationDTO dto, String operatorIp);

    void delete(Long id, String operator, String operatorIp);

    ReservationDTO getById(Long id);

    PageResult<ReservationDTO> list(ReservationQueryDTO query);

    ConflictResultDTO checkConflict(ConflictCheckDTO dto);

    ReservationDTO cancel(Long id, String operator, String operatorIp);

    BatchReservationResultDTO batchCreate(BatchReservationDTO dto, String operatorIp);
}
