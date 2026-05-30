package com.track.collector;

import com.github.benmanes.caffeine.cache.Cache;
import com.track.common.dto.HeartbeatRequest;
import com.track.common.dto.VisitRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class DeduplicationService {

    private static final long HEARTBEAT_DEDUP_WINDOW_MILLIS = 25_000L;

    private final Cache<String, Boolean> deduplicationCache;

    public DeduplicationService(@Qualifier("deduplicationCache") Cache<String, Boolean> deduplicationCache) {
        this.deduplicationCache = deduplicationCache;
    }

    public boolean isDuplicate(String eventId) {
        Boolean existing = deduplicationCache.getIfPresent(eventId);
        if (existing != null) {
            return true;
        }
        deduplicationCache.put(eventId, Boolean.TRUE);
        return false;
    }

    public String generateEventId(VisitRequest request) {
        if (request.getSessionId() != null && request.getPageUrl() != null && request.getTimestamp() != null) {
            return generateContentHash(request);
        }
        return UUID.randomUUID().toString();
    }

    public String generateContentHash(VisitRequest request) {
        String raw = request.getSessionId() + "|" + request.getPageUrl() + "|" + request.getTimestamp();
        return sha256Hex(raw);
    }

    public String generateHeartbeatEventId(HeartbeatRequest request) {
        if (request.getSessionId() != null && request.getPageUrl() != null && request.getTimestamp() != null) {
            long quantized = (request.getTimestamp() / HEARTBEAT_DEDUP_WINDOW_MILLIS) * HEARTBEAT_DEDUP_WINDOW_MILLIS;
            String raw = "hb|" + request.getSessionId() + "|" + request.getPageUrl() + "|" + quantized;
            return sha256Hex(raw);
        }
        return UUID.randomUUID().toString();
    }

    private String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return UUID.randomUUID().toString();
        }
    }
}
