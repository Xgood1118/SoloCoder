package com.track.common.service;

import com.track.common.entity.Session;
import com.track.common.entity.VisitEvent;

import java.time.LocalDateTime;

public interface SessionManagerService {

    void updateSession(VisitEvent event);

    void updateLastActive(String sessionId, LocalDateTime lastActiveAt);

    Session getOrCreateSession(String sessionId);

    void activateSession(String sessionId);

    void expireSession(String sessionId);

    void manualEndSession(String sessionId);

    Session getSession(String sessionId);

    void handleHeartbeat(String sessionId, String pageUrl);
}
