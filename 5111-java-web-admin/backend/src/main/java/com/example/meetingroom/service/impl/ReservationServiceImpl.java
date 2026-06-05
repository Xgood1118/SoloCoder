package com.example.meetingroom.service.impl;

import com.example.meetingroom.dto.*;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.Equipment;
import com.example.meetingroom.entity.MeetingRoom;
import com.example.meetingroom.entity.Reservation;
import com.example.meetingroom.enums.ReservationStatus;
import com.example.meetingroom.exception.BusinessException;
import com.example.meetingroom.repository.ReservationRepository;
import com.example.meetingroom.service.EquipmentService;
import com.example.meetingroom.service.MeetingRoomService;
import com.example.meetingroom.service.ReservationService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReservationServiceImpl implements ReservationService {

    private final ReservationRepository reservationRepository;
    private final MeetingRoomService meetingRoomService;
    private final EquipmentService equipmentService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReservationDTO create(ReservationDTO dto, String operatorIp) {
        validateReservationTime(dto.getStartTime(), dto.getEndTime());
        MeetingRoom room = meetingRoomService.getEntityById(dto.getRoomId());
        meetingRoomService.validateRoomAvailable(room, dto.getStartTime(), dto.getEndTime());
        ConflictResultDTO conflictResult = checkConflictInternal(dto.getRoomId(),
                dto.getStartTime(), dto.getEndTime(), null);
        if (conflictResult.getConflict()) {
            throw new BusinessException("预定冲突：" + conflictResult.getMessage());
        }
        List<Equipment> equipmentList = equipmentService.findActiveEquipmentByRoomId(dto.getRoomId());
        List<Long> equipmentIds = equipmentList.stream()
                .map(Equipment::getId)
                .collect(Collectors.toList());
        Reservation reservation = new Reservation();
        BeanUtils.copyProperties(dto, reservation);
        reservation.setRoomNumber(room.getRoomNumber());
        reservation.setRoomName(room.getRoomName());
        reservation.setStatus(ReservationStatus.CONFIRMED.getCode());
        reservation = reservationRepository.save(reservation);
        if (!equipmentIds.isEmpty()) {
            equipmentService.lockEquipmentList(equipmentIds, reservation.getId(), room.getId(),
                    dto.getStartTime(), dto.getEndTime(), dto.getReserverName(), operatorIp);
        }
        return convertToDTO(reservation);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReservationDTO update(Long id, ReservationDTO dto, String operatorIp) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("预定不存在"));
        if (reservation.getStatus() != ReservationStatus.CONFIRMED.getCode()) {
            throw new BusinessException("只能修改已确认的预定");
        }
        validateReservationTime(dto.getStartTime(), dto.getEndTime());
        boolean roomChanged = !reservation.getRoomId().equals(dto.getRoomId());
        boolean timeChanged = !reservation.getStartTime().equals(dto.getStartTime())
                || !reservation.getEndTime().equals(dto.getEndTime());
        if (roomChanged || timeChanged) {
            MeetingRoom room = meetingRoomService.getEntityById(dto.getRoomId());
            meetingRoomService.validateRoomAvailable(room, dto.getStartTime(), dto.getEndTime());
            ConflictResultDTO conflictResult = checkConflictInternal(dto.getRoomId(),
                    dto.getStartTime(), dto.getEndTime(), id);
            if (conflictResult.getConflict()) {
                throw new BusinessException("预定冲突：" + conflictResult.getMessage());
            }
        }
        List<Equipment> oldEquipments = equipmentService.findActiveEquipmentByRoomId(reservation.getRoomId());
        List<Long> oldEquipmentIds = oldEquipments.stream()
                .map(Equipment::getId)
                .collect(Collectors.toList());
        if (!oldEquipmentIds.isEmpty()) {
            equipmentService.unlockEquipmentList(oldEquipmentIds, id, reservation.getRoomId(),
                    reservation.getStartTime(), reservation.getEndTime(),
                    dto.getReserverName(), operatorIp);
        }
        MeetingRoom newRoom = meetingRoomService.getEntityById(dto.getRoomId());
        List<Equipment> newEquipments = equipmentService.findActiveEquipmentByRoomId(dto.getRoomId());
        List<Long> newEquipmentIds = newEquipments.stream()
                .map(Equipment::getId)
                .collect(Collectors.toList());
        BeanUtils.copyProperties(dto, reservation, "id", "createdAt");
        reservation.setRoomNumber(newRoom.getRoomNumber());
        reservation.setRoomName(newRoom.getRoomName());
        reservation = reservationRepository.save(reservation);
        if (!newEquipmentIds.isEmpty()) {
            equipmentService.lockEquipmentList(newEquipmentIds, reservation.getId(), newRoom.getId(),
                    dto.getStartTime(), dto.getEndTime(), dto.getReserverName(), operatorIp);
        }
        return convertToDTO(reservation);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id, String operator, String operatorIp) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("预定不存在"));
        List<Equipment> equipmentList = equipmentService.findActiveEquipmentByRoomId(reservation.getRoomId());
        List<Long> equipmentIds = equipmentList.stream()
                .map(Equipment::getId)
                .collect(Collectors.toList());
        if (!equipmentIds.isEmpty()) {
            equipmentService.unlockEquipmentList(equipmentIds, id, reservation.getRoomId(),
                    reservation.getStartTime(), reservation.getEndTime(),
                    operator, operatorIp);
        }
        reservationRepository.delete(reservation);
    }

    @Override
    public ReservationDTO getById(Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("预定不存在"));
        return convertToDTO(reservation);
    }

    @Override
    public PageResult<ReservationDTO> list(ReservationQueryDTO query) {
        Pageable pageable = PageRequest.of(query.getPageNum() - 1, query.getPageSize());
        Specification<Reservation> spec = buildSpecification(query);
        Page<Reservation> page = reservationRepository.findAll(spec, pageable);
        List<ReservationDTO> records = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        return PageResult.of(page.getTotalElements(), records, query.getPageNum(), query.getPageSize());
    }

    @Override
    public ConflictResultDTO checkConflict(ConflictCheckDTO dto) {
        validateReservationTime(dto.getStartTime(), dto.getEndTime());
        MeetingRoom room = meetingRoomService.getEntityById(dto.getRoomId());
        meetingRoomService.validateRoomAvailable(room, dto.getStartTime(), dto.getEndTime());
        return checkConflictInternal(dto.getRoomId(), dto.getStartTime(),
                dto.getEndTime(), dto.getExcludeReservationId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReservationDTO cancel(Long id, String operator, String operatorIp) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("预定不存在"));
        if (reservation.getStatus() != ReservationStatus.CONFIRMED.getCode()) {
            throw new BusinessException("只能取消已确认的预定");
        }
        List<Equipment> equipmentList = equipmentService.findActiveEquipmentByRoomId(reservation.getRoomId());
        List<Long> equipmentIds = equipmentList.stream()
                .map(Equipment::getId)
                .collect(Collectors.toList());
        if (!equipmentIds.isEmpty()) {
            equipmentService.unlockEquipmentList(equipmentIds, id, reservation.getRoomId(),
                    reservation.getStartTime(), reservation.getEndTime(),
                    operator, operatorIp);
        }
        reservation.setStatus(ReservationStatus.CANCELLED.getCode());
        reservation = reservationRepository.save(reservation);
        return convertToDTO(reservation);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchReservationResultDTO batchCreate(BatchReservationDTO dto, String operatorIp) {
        List<ReservationDTO> reservations = dto.getReservations();
        BatchReservationResultDTO result = new BatchReservationResultDTO();
        result.setTotalCount(reservations.size());
        result.setSuccessCount(0);
        result.setFailCount(0);
        result.setSuccessReservations(new ArrayList<>());
        result.setFailItems(new ArrayList<>());
        String operator = dto.getOperator();
        if (!StringUtils.hasText(operator) && !reservations.isEmpty()) {
            operator = reservations.get(0).getReserverName();
        }
        for (int i = 0; i < reservations.size(); i++) {
            ReservationDTO reservationDTO = reservations.get(i);
            try {
                ReservationDTO created = create(reservationDTO, operatorIp);
                result.getSuccessReservations().add(created);
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (Exception e) {
                result.getFailItems().add(new BatchReservationResultDTO.BatchReservationFailItem(
                        i, reservationDTO, e.getMessage()));
                result.setFailCount(result.getFailCount() + 1);
            }
        }
        return result;
    }

    private ConflictResultDTO checkConflictInternal(Long roomId, LocalDateTime startTime,
                                                     LocalDateTime endTime, Long excludeId) {
        List<Reservation> conflictingReservations = reservationRepository.findConflictingReservations(
                roomId, startTime, endTime, excludeId);
        if (conflictingReservations.isEmpty()) {
            return ConflictResultDTO.noConflict();
        }
        List<ReservationDTO> conflictingDTOs = conflictingReservations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        return ConflictResultDTO.hasConflict(conflictingDTOs);
    }

    private void validateReservationTime(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            throw new BusinessException("开始时间和结束时间不能为空");
        }
        if (startTime.isAfter(endTime)) {
            throw new BusinessException("开始时间不能晚于结束时间");
        }
        if (startTime.isBefore(LocalDateTime.now())) {
            throw new BusinessException("开始时间不能早于当前时间");
        }
        if (startTime.toLocalDate().isBefore(endTime.toLocalDate())) {
            throw new BusinessException("预定不能跨天");
        }
    }

    private Specification<Reservation> buildSpecification(ReservationQueryDTO query) {
        return (root, cb, cq) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (query.getRoomId() != null) {
                predicates.add(cb.equal(root.get("roomId"), query.getRoomId()));
            }
            if (StringUtils.hasText(query.getRoomNumber())) {
                predicates.add(cb.like(root.get("roomNumber"), "%" + query.getRoomNumber() + "%"));
            }
            if (StringUtils.hasText(query.getReserverName())) {
                predicates.add(cb.like(root.get("reserverName"), "%" + query.getReserverName() + "%"));
            }
            if (StringUtils.hasText(query.getMeetingTopic())) {
                predicates.add(cb.like(root.get("meetingTopic"), "%" + query.getMeetingTopic() + "%"));
            }
            if (query.getStartTime() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("startTime"), query.getStartTime()));
            }
            if (query.getEndTime() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("endTime"), query.getEndTime()));
            }
            if (query.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), query.getStatus()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private ReservationDTO convertToDTO(Reservation reservation) {
        ReservationDTO dto = new ReservationDTO();
        BeanUtils.copyProperties(reservation, dto);
        return dto;
    }
}
