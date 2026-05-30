package com.featureflag.service;

import com.featureflag.entity.AuditLog;
import com.featureflag.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public void logChange(String flagKey, String application, String action, String operator,
                          String oldValue, String newValue, String changeReason,
                          String ipAddress, String userAgent) {
        AuditLog log = new AuditLog();
        log.setFlagKey(flagKey);
        log.setApplication(application);
        log.setAction(action);
        log.setOperator(operator);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setChangeReason(changeReason);
        log.setIpAddress(ipAddress);
        log.setUserAgent(userAgent);
        auditLogRepository.save(log);
    }

    public Page<AuditLog> getAuditLogsByFlag(String flagKey, Pageable pageable) {
        return auditLogRepository.findByFlagKeyOrderByCreatedAtDesc(flagKey, pageable);
    }

    public List<AuditLog> getAuditLogsByFlagAndTime(String flagKey, LocalDateTime start, LocalDateTime end) {
        return auditLogRepository.findByFlagKeyAndCreatedAtBetween(flagKey, start, end);
    }

    public List<AuditLog> getAuditLogsByOperator(String operator) {
        return auditLogRepository.findByOperatorOrderByCreatedAtDesc(operator);
    }
}
