package com.track.session;

import com.track.common.dto.PageVisitInfo;
import com.track.common.dto.SessionDetailResponse;
import com.track.common.entity.Session;
import com.track.common.entity.VisitEvent;
import com.track.common.repository.SessionRepository;
import com.track.common.repository.VisitEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionQueryService implements com.track.common.service.SessionQueryService {

    private final SessionRepository sessionRepository;
    private final VisitEventRepository visitEventRepository;

    public SessionDetailResponse getSessionDetail(String sessionId) {
        Session session = sessionRepository.findBySessionId(sessionId).orElse(null);
        if (session == null) {
            return null;
        }

        List<VisitEvent> visitEvents = visitEventRepository.findBySessionIdOrderByTimestampAsc(sessionId);

        List<PageVisitInfo> pages = buildPageVisitInfoList(visitEvents, session);
        List<String> pathSequence = buildPathSequence(visitEvents);

        SessionDetailResponse response = new SessionDetailResponse();
        response.setSessionId(session.getSessionId());
        response.setUserId(session.getUserId());
        response.setFingerprintId(session.getFingerprintId());
        response.setStatus(session.getStatus());
        response.setCreatedAt(session.getCreatedAt());
        response.setLastActiveAt(session.getLastActiveAt());
        response.setTotalDuration(session.getTotalDuration());
        response.setPageViewCount(session.getPageViewCount());
        response.setPages(pages);
        response.setPathSequence(pathSequence);
        return response;
    }

    private List<PageVisitInfo> buildPageVisitInfoList(List<VisitEvent> visitEvents, Session session) {
        List<PageVisitInfo> pages = new ArrayList<>();

        for (int i = 0; i < visitEvents.size(); i++) {
            VisitEvent current = visitEvents.get(i);
            PageVisitInfo info = new PageVisitInfo();
            info.setPageUrl(current.getPageUrl());
            info.setReferrer(current.getReferrer());
            info.setEnterTime(current.getTimestamp());

            LocalDateTime leaveTime;
            if (i + 1 < visitEvents.size()) {
                leaveTime = visitEvents.get(i + 1).getTimestamp();
            } else if (session.getLastActiveAt() != null) {
                leaveTime = session.getLastActiveAt();
            } else {
                leaveTime = current.getTimestamp();
            }
            info.setLeaveTime(leaveTime);

            if (info.getEnterTime() != null && leaveTime != null) {
                info.setDurationSeconds(Duration.between(info.getEnterTime(), leaveTime).getSeconds());
            } else {
                info.setDurationSeconds(0L);
            }

            pages.add(info);
        }

        return pages;
    }

    private List<String> buildPathSequence(List<VisitEvent> visitEvents) {
        LinkedHashSet<String> pathSet = new LinkedHashSet<>();
        for (VisitEvent event : visitEvents) {
            pathSet.add(event.getPageUrl());
        }
        return new ArrayList<>(pathSet);
    }
}
