package com.example.meetingroom.service.impl;

import com.example.meetingroom.dto.AvailableRoomQueryDTO;
import com.example.meetingroom.dto.MeetingRoomDTO;
import com.example.meetingroom.dto.MeetingRoomQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.MeetingRoom;
import com.example.meetingroom.exception.BusinessException;
import com.example.meetingroom.repository.EquipmentRepository;
import com.example.meetingroom.repository.MeetingRoomRepository;
import com.example.meetingroom.service.MeetingRoomService;
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

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MeetingRoomServiceImpl implements MeetingRoomService {

    private final MeetingRoomRepository meetingRoomRepository;
    private final EquipmentRepository equipmentRepository;

    @Override
    @Transactional
    public MeetingRoomDTO create(MeetingRoomDTO dto) {
        if (meetingRoomRepository.existsByRoomNumber(dto.getRoomNumber())) {
            throw new BusinessException("会议室编号已存在");
        }
        MeetingRoom room = new MeetingRoom();
        BeanUtils.copyProperties(dto, room);
        room = meetingRoomRepository.save(room);
        return convertToDTO(room);
    }

    @Override
    @Transactional
    public MeetingRoomDTO update(Long id, MeetingRoomDTO dto) {
        MeetingRoom room = getEntityById(id);
        if (!room.getRoomNumber().equals(dto.getRoomNumber())
                && meetingRoomRepository.existsByRoomNumber(dto.getRoomNumber())) {
            throw new BusinessException("会议室编号已存在");
        }
        BeanUtils.copyProperties(dto, room, "id");
        room = meetingRoomRepository.save(room);
        return convertToDTO(room);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        MeetingRoom room = getEntityById(id);
        equipmentRepository.unbindAllEquipmentFromRoom(id);
        meetingRoomRepository.delete(room);
    }

    @Override
    public MeetingRoomDTO getById(Long id) {
        return convertToDTO(getEntityById(id));
    }

    @Override
    public PageResult<MeetingRoomDTO> list(MeetingRoomQueryDTO query) {
        Pageable pageable = PageRequest.of(query.getPageNum() - 1, query.getPageSize());
        Specification<MeetingRoom> spec = buildSpecification(query);
        Page<MeetingRoom> page = meetingRoomRepository.findAll(spec, pageable);
        List<MeetingRoomDTO> records = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        return PageResult.of(page.getTotalElements(), records, query.getPageNum(), query.getPageSize());
    }

    @Override
    public List<MeetingRoomDTO> findAvailableRooms(LocalDateTime startTime, LocalDateTime endTime) {
        validateTimeRange(startTime, endTime);
        List<MeetingRoom> rooms = meetingRoomRepository.findAvailableRooms(startTime, endTime);
        return rooms.stream()
                .filter(room -> isRoomAvailableForTime(room, startTime, endTime))
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MeetingRoomDTO> findAvailableRoomsWithFilter(AvailableRoomQueryDTO query) {
        validateTimeRange(query.getStartTime(), query.getEndTime());
        List<MeetingRoom> rooms = meetingRoomRepository.findAvailableRoomsWithFilter(
                query.getStartTime(), query.getEndTime(), query.getWeekendAvailable());
        return rooms.stream()
                .filter(room -> isRoomAvailableForTime(room, query.getStartTime(), query.getEndTime()))
                .filter(room -> query.getMinCapacity() == null || room.getCapacity() >= query.getMinCapacity())
                .filter(room -> !StringUtils.hasText(query.getLocation())
                        || (room.getLocation() != null && room.getLocation().contains(query.getLocation())))
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MeetingRoomDTO> getAllActiveRooms() {
        return meetingRoomRepository.findByStatus(1).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public MeetingRoom getEntityById(Long id) {
        return meetingRoomRepository.findById(id)
                .orElseThrow(() -> new BusinessException("会议室不存在"));
    }

    @Override
    public void validateRoomAvailable(MeetingRoom room, LocalDateTime startTime, LocalDateTime endTime) {
        if (room.getStatus() != 1) {
            throw new BusinessException("会议室[" + room.getRoomName() + "]已停用");
        }
        if (!isRoomAvailableForTime(room, startTime, endTime)) {
            DayOfWeek dayOfWeek = startTime.getDayOfWeek();
            boolean isWeekend = dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
            if (isWeekend && !room.getWeekendAvailable()) {
                throw new BusinessException("会议室[" + room.getRoomName() + "]周末不开放");
            }
            LocalTime openTime = room.getOpenTime();
            LocalTime closeTime = room.getCloseTime();
            if (openTime != null && closeTime != null) {
                throw new BusinessException("会议室[" + room.getRoomName() + "]开放时间为"
                        + openTime + "至" + closeTime);
            }
            throw new BusinessException("会议室[" + room.getRoomName() + "]该时间段不可用");
        }
    }

    private boolean isRoomAvailableForTime(MeetingRoom room, LocalDateTime startTime, LocalDateTime endTime) {
        DayOfWeek dayOfWeek = startTime.getDayOfWeek();
        boolean isWeekend = dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
        if (isWeekend && !room.getWeekendAvailable()) {
            return false;
        }
        LocalTime openTime = room.getOpenTime();
        LocalTime closeTime = room.getCloseTime();
        if (openTime != null && closeTime != null) {
            LocalTime startLocalTime = startTime.toLocalTime();
            LocalTime endLocalTime = endTime.toLocalTime();
            if (startLocalTime.isBefore(openTime) || endLocalTime.isAfter(closeTime)) {
                return false;
            }
        }
        return true;
    }

    private void validateTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            throw new BusinessException("开始时间和结束时间不能为空");
        }
        if (startTime.isAfter(endTime)) {
            throw new BusinessException("开始时间不能晚于结束时间");
        }
        if (startTime.isBefore(LocalDateTime.now())) {
            throw new BusinessException("开始时间不能早于当前时间");
        }
    }

    private Specification<MeetingRoom> buildSpecification(MeetingRoomQueryDTO query) {
        return (root, cb, cq) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(query.getRoomNumber())) {
                predicates.add(cb.like(root.get("roomNumber"), "%" + query.getRoomNumber() + "%"));
            }
            if (StringUtils.hasText(query.getRoomName())) {
                predicates.add(cb.like(root.get("roomName"), "%" + query.getRoomName() + "%"));
            }
            if (query.getMinCapacity() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("capacity"), query.getMinCapacity()));
            }
            if (query.getMaxCapacity() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("capacity"), query.getMaxCapacity()));
            }
            if (StringUtils.hasText(query.getLocation())) {
                predicates.add(cb.like(root.get("location"), "%" + query.getLocation() + "%"));
            }
            if (query.getWeekendAvailable() != null) {
                predicates.add(cb.equal(root.get("weekendAvailable"), query.getWeekendAvailable()));
            }
            if (query.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), query.getStatus()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private MeetingRoomDTO convertToDTO(MeetingRoom room) {
        MeetingRoomDTO dto = new MeetingRoomDTO();
        BeanUtils.copyProperties(room, dto);
        return dto;
    }
}
