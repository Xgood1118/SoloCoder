package com.track.session;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.track.common.entity.Session;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class SessionCacheManager {

    private final Cache<String, Session> activeSessionCache;

    public SessionCacheManager() {
        this.activeSessionCache = Caffeine.newBuilder()
                .maximumSize(100000)
                .expireAfterAccess(30, TimeUnit.MINUTES)
                .recordStats()
                .build();
    }

    public Session getActiveSession(String sessionId) {
        return activeSessionCache.getIfPresent(sessionId);
    }

    public void putActiveSession(Session session) {
        activeSessionCache.put(session.getSessionId(), session);
    }

    public void removeActiveSession(String sessionId) {
        activeSessionCache.invalidate(sessionId);
    }

    public long getActiveSessionCount() {
        return activeSessionCache.estimatedSize();
    }

    public List<Session> getAllActiveSessions() {
        return new ArrayList<>(activeSessionCache.asMap().values());
    }
}
