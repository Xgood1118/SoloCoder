package com.track.session;

import com.track.common.entity.Session;
import com.track.common.enums.SessionStatus;
import com.track.common.service.SessionManagerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SessionTimeoutScheduler {

    private static final long IDLE_THRESHOLD_MINUTES = 5;
    private static final long EXPIRE_THRESHOLD_MINUTES = 30;

    private final SessionCacheManager sessionCacheManager;
    private final SessionManagerService sessionManagerService;

    @Scheduled(fixedRate = 300000)
    public void checkSessionTimeouts() {
        List<Session> activeSessions = sessionCacheManager.getAllActiveSessions();
        if (activeSessions.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        int idleCount = 0;
        int expiredCount = 0;

        List<Session> sessionsToProcess = new ArrayList<>(activeSessions);
        for (Session session : sessionsToProcess) {
            if (session.getLastActiveAt() == null) {
                continue;
            }

            long inactiveMinutes = java.time.Duration.between(session.getLastActiveAt(), now).toMinutes();

            if (inactiveMinutes >= EXPIRE_THRESHOLD_MINUTES) {
                sessionManagerService.expireSession(session.getSessionId());
                expiredCount++;
            } else if (inactiveMinutes >= IDLE_THRESHOLD_MINUTES && session.getStatus() == SessionStatus.ACTIVE) {
                session.setStatus(SessionStatus.IDLE);
                sessionCacheManager.putActiveSession(session);
                idleCount++;
            }
        }

        if (idleCount > 0 || expiredCount > 0) {
            log.info("Session timeout check: {} idle, {} expired", idleCount, expiredCount);
        }
    }
}
