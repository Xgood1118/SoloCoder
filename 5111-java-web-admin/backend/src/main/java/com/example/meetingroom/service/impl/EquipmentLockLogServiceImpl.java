package com.example.meetingroom.service.impl;

import com.example.meetingroom.dto.EquipmentLockLogQueryDTO;
import com.example.meetingroom.common.PageResult;
import com.example.meetingroom.entity.EquipmentLockLog;
import com.example.meetingroom.repository.EquipmentLockLogRepository;
import com.example.meetingroom.service.EquipmentLockLogService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EquipmentLockLogServiceImpl implements EquipmentLockLogService {

    private final EquipmentLockLogRepository lockLogRepository;

    @Override
    public PageResult<EquipmentLockLog> list(EquipmentLockLogQueryDTO query) {
        Pageable pageable = PageRequest.of(query.getPageNum() - 1, query.getPageSize(),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<EquipmentLockLog> spec = buildSpecification(query);
        Page<EquipmentLockLog> page = lockLogRepository.findAll(spec, pageable);
        return PageResult.of(page.getTotalElements(), page.getContent(),
                query.getPageNum(), query.getPageSize());
    }

    @Override
    public List<EquipmentLockLog> findByEquipmentId(Long equipmentId) {
        return lockLogRepository.findByEquipmentIdOrderByCreatedAtDesc(equipmentId);
    }

    @Override
    public List<EquipmentLockLog> findByReservationId(Long reservationId) {
        return lockLogRepository.findByReservationId(reservationId);
    }

    private Specification<EquipmentLockLog> buildSpecification(EquipmentLockLogQueryDTO query) {
        return (root, cb, cq) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (query.getEquipmentId() != null) {
                predicates.add(cb.equal(root.get("equipmentId"), query.getEquipmentId()));
            }
            if (StringUtils.hasText(query.getEquipmentCode())) {
                predicates.add(cb.like(root.get("equipmentCode"), "%" + query.getEquipmentCode() + "%"));
            }
            if (query.getReservationId() != null) {
                predicates.add(cb.equal(root.get("reservationId"), query.getReservationId()));
            }
            if (query.getRoomId() != null) {
                predicates.add(cb.equal(root.get("roomId"), query.getRoomId()));
            }
            if (StringUtils.hasText(query.getLockType())) {
                predicates.add(cb.equal(root.get("lockType"), query.getLockType()));
            }
            if (StringUtils.hasText(query.getOperator())) {
                predicates.add(cb.like(root.get("operator"), "%" + query.getOperator() + "%"));
            }
            if (query.getStartTime() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), query.getStartTime()));
            }
            if (query.getEndTime() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), query.getEndTime()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
