package com.example.meetingroom.service.impl;

import com.example.meetingroom.dto.EquipmentDTO;
import com.example.meetingroom.dto.EquipmentQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.Equipment;
import com.example.meetingroom.entity.EquipmentLockLog;
import com.example.meetingroom.entity.MeetingRoom;
import com.example.meetingroom.enums.LockType;
import com.example.meetingroom.exception.BusinessException;
import com.example.meetingroom.repository.EquipmentLockLogRepository;
import com.example.meetingroom.repository.EquipmentRepository;
import com.example.meetingroom.repository.MeetingRoomRepository;
import com.example.meetingroom.service.EquipmentService;
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
public class EquipmentServiceImpl implements EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final MeetingRoomRepository meetingRoomRepository;
    private final EquipmentLockLogRepository lockLogRepository;

    @Override
    @Transactional
    public EquipmentDTO create(EquipmentDTO dto) {
        if (equipmentRepository.existsByEquipmentCode(dto.getEquipmentCode())) {
            throw new BusinessException("设备编号已存在");
        }
        Equipment equipment = new Equipment();
        BeanUtils.copyProperties(dto, equipment);
        if (dto.getRoomId() != null) {
            MeetingRoom room = meetingRoomRepository.findById(dto.getRoomId())
                    .orElseThrow(() -> new BusinessException("会议室不存在"));
            equipment.setRoomId(room.getId());
        }
        equipment = equipmentRepository.save(equipment);
        return convertToDTO(equipment);
    }

    @Override
    @Transactional
    public EquipmentDTO update(Long id, EquipmentDTO dto) {
        Equipment equipment = getEntityById(id);
        if (!equipment.getEquipmentCode().equals(dto.getEquipmentCode())
                && equipmentRepository.existsByEquipmentCode(dto.getEquipmentCode())) {
            throw new BusinessException("设备编号已存在");
        }
        BeanUtils.copyProperties(dto, equipment, "id", "locked");
        if (dto.getRoomId() != null && !dto.getRoomId().equals(equipment.getRoomId())) {
            meetingRoomRepository.findById(dto.getRoomId())
                    .orElseThrow(() -> new BusinessException("会议室不存在"));
        }
        equipment = equipmentRepository.save(equipment);
        return convertToDTO(equipment);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Equipment equipment = getEntityById(id);
        if (equipment.getLocked()) {
            throw new BusinessException("设备已锁定，无法删除");
        }
        equipmentRepository.delete(equipment);
    }

    @Override
    public EquipmentDTO getById(Long id) {
        return convertToDTO(getEntityById(id));
    }

    @Override
    public PageResult<EquipmentDTO> list(EquipmentQueryDTO query) {
        Pageable pageable = PageRequest.of(query.getPageNum() - 1, query.getPageSize());
        Specification<Equipment> spec = buildSpecification(query);
        Page<Equipment> page = equipmentRepository.findAll(spec, pageable);
        List<EquipmentDTO> records = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        return PageResult.of(page.getTotalElements(), records, query.getPageNum(), query.getPageSize());
    }

    @Override
    @Transactional
    public EquipmentDTO bindToRoom(Long equipmentId, Long roomId) {
        Equipment equipment = getEntityById(equipmentId);
        if (equipment.getLocked()) {
            throw new BusinessException("设备已锁定，无法绑定");
        }
        MeetingRoom room = meetingRoomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException("会议室不存在"));
        equipment.setRoomId(room.getId());
        equipment = equipmentRepository.save(equipment);
        return convertToDTO(equipment);
    }

    @Override
    @Transactional
    public EquipmentDTO unbindFromRoom(Long equipmentId) {
        Equipment equipment = getEntityById(equipmentId);
        if (equipment.getLocked()) {
            throw new BusinessException("设备已锁定，无法解绑");
        }
        equipment.setRoomId(null);
        equipment = equipmentRepository.save(equipment);
        return convertToDTO(equipment);
    }

    @Override
    @Transactional
    public void unbindAllFromRoom(Long roomId) {
        List<Equipment> equipmentList = equipmentRepository.findByRoomId(roomId);
        for (Equipment equipment : equipmentList) {
            if (equipment.getLocked()) {
                throw new BusinessException("存在已锁定的设备，无法全部解绑");
            }
            equipment.setRoomId(null);
        }
        equipmentRepository.saveAll(equipmentList);
    }

    @Override
    public List<EquipmentDTO> findByRoomId(Long roomId) {
        return equipmentRepository.findByRoomId(roomId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<EquipmentDTO> findUnboundEquipment() {
        return equipmentRepository.findByRoomIdIsNull().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<Equipment> findActiveEquipmentByRoomId(Long roomId) {
        return equipmentRepository.findByRoomIdAndStatus(roomId, 1);
    }

    @Override
    public Equipment getEntityById(Long id) {
        return equipmentRepository.findById(id)
                .orElseThrow(() -> new BusinessException("设备不存在"));
    }

    @Override
    @Transactional
    public void lockEquipment(Long equipmentId, Long reservationId, Long roomId,
                              LocalDateTime startTime, LocalDateTime endTime,
                              String operator, String operatorIp) {
        Equipment equipment = getEntityById(equipmentId);
        if (equipment.getLocked()) {
            throw new BusinessException("设备[" + equipment.getEquipmentName() + "]已被锁定");
        }
        equipment.setLocked(true);
        equipmentRepository.save(equipment);
        recordLockLog(equipment, reservationId, roomId, LockType.LOCK,
                startTime, endTime, operator, operatorIp);
    }

    @Override
    @Transactional
    public void unlockEquipment(Long equipmentId, Long reservationId, Long roomId,
                                LocalDateTime startTime, LocalDateTime endTime,
                                String operator, String operatorIp) {
        Equipment equipment = getEntityById(equipmentId);
        equipment.setLocked(false);
        equipmentRepository.save(equipment);
        recordLockLog(equipment, reservationId, roomId, LockType.UNLOCK,
                startTime, endTime, operator, operatorIp);
    }

    @Override
    @Transactional
    public void forceUnlockEquipment(Long equipmentId, String operator, String operatorIp) {
        Equipment equipment = getEntityById(equipmentId);
        equipment.setLocked(false);
        equipmentRepository.save(equipment);
        recordLockLog(equipment, null, equipment.getRoomId(), LockType.FORCE_UNLOCK,
                null, null, operator, operatorIp);
    }

    @Override
    @Transactional
    public void lockEquipmentList(List<Long> equipmentIds, Long reservationId, Long roomId,
                                  LocalDateTime startTime, LocalDateTime endTime,
                                  String operator, String operatorIp) {
        if (equipmentIds == null || equipmentIds.isEmpty()) {
            return;
        }
        if (equipmentRepository.existsLockedEquipment(equipmentIds)) {
            List<Equipment> lockedEquipments = equipmentRepository.findAllById(equipmentIds).stream()
                    .filter(Equipment::getLocked)
                    .collect(Collectors.toList());
            String names = lockedEquipments.stream()
                    .map(Equipment::getEquipmentName)
                    .collect(Collectors.joining(", "));
            throw new BusinessException("以下设备已被锁定: " + names);
        }
        equipmentRepository.updateLockedStatus(equipmentIds, true);
        List<Equipment> equipmentList = equipmentRepository.findAllById(equipmentIds);
        for (Equipment equipment : equipmentList) {
            recordLockLog(equipment, reservationId, roomId, LockType.LOCK,
                    startTime, endTime, operator, operatorIp);
        }
    }

    @Override
    @Transactional
    public void unlockEquipmentList(List<Long> equipmentIds, Long reservationId, Long roomId,
                                    LocalDateTime startTime, LocalDateTime endTime,
                                    String operator, String operatorIp) {
        if (equipmentIds == null || equipmentIds.isEmpty()) {
            return;
        }
        equipmentRepository.updateLockedStatus(equipmentIds, false);
        List<Equipment> equipmentList = equipmentRepository.findAllById(equipmentIds);
        for (Equipment equipment : equipmentList) {
            recordLockLog(equipment, reservationId, roomId, LockType.UNLOCK,
                    startTime, endTime, operator, operatorIp);
        }
    }

    private void recordLockLog(Equipment equipment, Long reservationId, Long roomId,
                               LockType lockType, LocalDateTime startTime, LocalDateTime endTime,
                               String operator, String operatorIp) {
        EquipmentLockLog log = new EquipmentLockLog();
        log.setEquipmentId(equipment.getId());
        log.setEquipmentCode(equipment.getEquipmentCode());
        log.setEquipmentName(equipment.getEquipmentName());
        log.setReservationId(reservationId);
        log.setRoomId(roomId);
        log.setLockType(lockType.getCode());
        log.setOperator(operator);
        log.setOperatorIp(operatorIp);
        log.setStartTime(startTime);
        log.setEndTime(endTime);
        lockLogRepository.save(log);
    }

    private Specification<Equipment> buildSpecification(EquipmentQueryDTO query) {
        return (root, cb, cq) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(query.getEquipmentCode())) {
                predicates.add(cb.like(root.get("equipmentCode"), "%" + query.getEquipmentCode() + "%"));
            }
            if (StringUtils.hasText(query.getEquipmentName())) {
                predicates.add(cb.like(root.get("equipmentName"), "%" + query.getEquipmentName() + "%"));
            }
            if (StringUtils.hasText(query.getEquipmentType())) {
                predicates.add(cb.like(root.get("equipmentType"), "%" + query.getEquipmentType() + "%"));
            }
            if (query.getRoomId() != null) {
                predicates.add(cb.equal(root.get("roomId"), query.getRoomId()));
            }
            if (Boolean.TRUE.equals(query.getUnboundOnly())) {
                predicates.add(cb.isNull(root.get("roomId")));
            }
            if (query.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), query.getStatus()));
            }
            if (query.getLocked() != null) {
                predicates.add(cb.equal(root.get("locked"), query.getLocked()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private EquipmentDTO convertToDTO(Equipment equipment) {
        EquipmentDTO dto = new EquipmentDTO();
        BeanUtils.copyProperties(equipment, dto);
        if (equipment.getRoomId() != null) {
            meetingRoomRepository.findById(equipment.getRoomId()).ifPresent(room ->
                    dto.setRoomName(room.getRoomName()));
        }
        return dto;
    }
}
