package com.track.session;

import com.track.common.entity.HeartbeatEvent;
import com.track.common.entity.VisitEvent;
import com.track.common.service.SessionManagerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class SessionEventHandler {

    private final SessionManagerService sessionManagerService;

    public void onVisitEvent(VisitEvent event) {
        sessionManagerService.updateSession(event);
    }

    public void onHeartbeatEvent(HeartbeatEvent event) {
        sessionManagerService.handleHeartbeat(event.getSessionId(), event.getPageUrl());
    }
}
