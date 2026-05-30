package com.audit.logger;

import com.audit.common.model.AuditLogEntry;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LogIntegrityChecker {

    private final ObjectMapper objectMapper;

    public String computeChecksum(AuditLogEntry entry) {
        try {
            String content = buildChecksumContent(entry);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available", e);
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    public boolean verify(AuditLogEntry entry) {
        if (entry.getChecksum() == null) {
            return false;
        }
        String computed = computeChecksum(entry);
        return computed.equals(entry.getChecksum());
    }

    public boolean verifyChain(List<AuditLogEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return true;
        }
        long prevSequence = -1;
        for (AuditLogEntry entry : entries) {
            if (entry.getSequenceNumber() <= prevSequence) {
                log.warn("Sequence number not monotonic: prev={}, current={}", prevSequence, entry.getSequenceNumber());
                return false;
            }
            if (!verify(entry)) {
                log.warn("Checksum verification failed for entry: {}", entry.getId());
                return false;
            }
            prevSequence = entry.getSequenceNumber();
        }
        return true;
    }

    private String buildChecksumContent(AuditLogEntry entry) {
        try {
            Map<String, Object> fields = objectMapper.convertValue(entry, Map.class);
            fields.remove("checksum");
            return objectMapper.writeValueAsString(fields);
        } catch (JsonProcessingException e) {
            log.error("Failed to build checksum content", e);
            throw new RuntimeException("Failed to build checksum content", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
