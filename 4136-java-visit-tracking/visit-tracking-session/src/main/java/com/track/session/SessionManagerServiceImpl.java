package com.track.session;

import com.track.common.entity.Session;
import com.track.common.entity.VisitEvent;
import com.track.common.enums.SessionStatus;
import com.track.common.repository.SessionRepository;
import com.track.common.service.DataWriterService;
import com.track.common.service.SessionManagerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionManagerServiceImpl implements SessionManagerService {

    private final SessionCacheManager sessionCacheManager;
    private final SessionRepository sessionRepository;
    private final DataWriterService dataWriterService;

    @Override
    public Session getOrCreateSession(String sessionId) {
        Session cached = sessionCacheManager.getActiveSession(sessionId);
        if (cached != null) {
            return cached;
        }

        Session persisted = sessionRepository.findBySessionId(sessionId).orElse(null);
        if (persisted != null) {
            sessionCacheManager.putActiveSession(persisted);
            return persisted;
        }

        Session newSession = new Session();
        newSession.setSessionId(sessionId);
        newSession.setStatus(SessionStatus.NEW);
        newSession.setCreatedAt(LocalDateTime.now());
        newSession.setLastActiveAt(LocalDateTime.now());
        newSession.setPageViewCount(0);
        dataWriterService.saveSession(newSession);
        sessionCacheManager.putActiveSession(newSession);
        log.info("Created new session: sessionId={}", sessionId);
        return newSession;
    }

    @Override
    public void activateSession(String sessionId) {
        Session session = getSession(sessionId);
        if (session != null && session.getStatus() == SessionStatus.NEW) {
            session.setStatus(SessionStatus.ACTIVE);
            dataWriterService.updateSession(session);
            sessionCacheManager.putActiveSession(session);
            log.info("Activated session: sessionId={}", sessionId);
        }
    }

    @Override
    public void updateSession(VisitEvent event) {
        Session session = getOrCreateSession(event.getSessionId());

        if (session.getStatus() == SessionStatus.NEW) {
            activateSession(event.getSessionId());
            session = getSession(event.getSessionId());
        }

        session.setPageViewCount(session.getPageViewCount() != null ? session.getPageViewCount() + 1 : 1);
        session.setReferrer(event.getReferrer());
        session.setCurrentPageUrl(event.getPageUrl());
        session.setLastActiveAt(LocalDateTime.now());
        dataWriterService.updateSession(session);
        sessionCacheManager.putActiveSession(session);
    }

    @Override
    public void updateLastActive(String sessionId, LocalDateTime lastActiveAt) {
        Session session = getSession(sessionId);
        if (session == null) {
            return;
        }

        if (session.getStatus() == SessionStatus.IDLE) {
            session.setStatus(SessionStatus.ACTIVE);
        }
        session.setLastActiveAt(lastActiveAt);
        dataWriterService.updateSession(session);
        sessionCacheManager.putActiveSession(session);
    }

    @Override
    public void expireSession(String sessionId) {
        Session session = getSession(sessionId);
        if (session == null) {
            return;
        }

        session.setStatus(SessionStatus.EXPIRED);
        if (session.getCreatedAt() != null && session.getLastActiveAt() != null) {
            session.setTotalDuration(Duration.between(session.getCreatedAt(), session.getLastActiveAt()).getSeconds());
        }
        session.setExpiredAt(session.getLastActiveAt());
        dataWriterService.updateSession(session);
        sessionCacheManager.removeActiveSession(sessionId);
        log.info("Expired session: sessionId={}, totalDuration={}s", sessionId, session.getTotalDuration());
    }

    @Override
    public void manualEndSession(String sessionId) {
        Session session = getSession(sessionId);
        if (session == null) {
            return;
        }

        session.setStatus(SessionStatus.MANUAL_END);
        if (session.getCreatedAt() != null && session.getLastActiveAt() != null) {
            session.setTotalDuration(Duration.between(session.getCreatedAt(), session.getLastActiveAt()).getSeconds());
        }
        session.setExpiredAt(session.getLastActiveAt());
        dataWriterService.updateSession(session);
        sessionCacheManager.removeActiveSession(sessionId);
        log.info("Manually ended session: sessionId={}, totalDuration={}s", sessionId, session.getTotalDuration());
    }

    @Override
    public Session getSession(String sessionId) {
        Session cached = sessionCacheManager.getActiveSession(sessionId);
        if (cached != null) {
            return cached;
        }
        return sessionRepository.findBySessionId(sessionId).orElse(null);
    }

    @Override
    public void handleHeartbeat(String sessionId, String pageUrl) {
        Session session = getSession(sessionId);
        if (session == null) {
            return;
        }

        session.setLastActiveAt(LocalDateTime.now());
        session.setCurrentPageUrl(pageUrl);
        dataWriterService.updateSession(session);
        sessionCacheManager.putActiveSession(session);
    }
}
