package com.track.path;

import com.track.common.entity.VisitEvent;
import com.track.common.repository.SessionRepository;
import com.track.common.repository.VisitEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class PathAnalysisService {

    private final VisitEventRepository visitEventRepository;
    private final SessionRepository sessionRepository;

    public double calculateBounceRate(String pageUrl) {
        List<String> sessions = visitEventRepository.findDistinctSessionIdsByPageUrl(pageUrl);
        if (sessions.isEmpty()) {
            return 0.0;
        }

        long bounceCount = 0;
        for (String sessionId : sessions) {
            List<VisitEvent> events = visitEventRepository.findBySessionIdOrderByTimestampAsc(sessionId);
            if (events == null || events.isEmpty()) {
                continue;
            }
            events.sort(Comparator.comparing(VisitEvent::getTimestamp,
                    Comparator.nullsLast(Comparator.naturalOrder())));

            if (events.get(0).getPageUrl().equals(pageUrl) && events.size() == 1) {
                bounceCount++;
            }
        }

        long entryCount = sessions.size();
        return (double) bounceCount / entryCount;
    }

    public double calculateExitRate(String pageUrl) {
        long totalVisits = visitEventRepository.countByPageUrl(pageUrl);
        if (totalVisits == 0) {
            return 0.0;
        }

        List<String> sessions = visitEventRepository.findDistinctSessionIdsByPageUrl(pageUrl);
        long exitCount = 0;
        for (String sessionId : sessions) {
            List<VisitEvent> events = visitEventRepository.findBySessionIdOrderByTimestampAsc(sessionId);
            if (events == null || events.isEmpty()) {
                continue;
            }
            events.sort(Comparator.comparing(VisitEvent::getTimestamp,
                    Comparator.nullsLast(Comparator.naturalOrder())));

            if (events.get(events.size() - 1).getPageUrl().equals(pageUrl)) {
                exitCount++;
            }
        }

        return (double) exitCount / totalVisits;
    }

    public double calculateAverageDepth(String pageUrl) {
        List<String> sessions = visitEventRepository.findDistinctSessionIdsByPageUrl(pageUrl);
        if (sessions.isEmpty()) {
            return 0.0;
        }

        double totalDepth = 0;
        int sessionCount = 0;

        for (String sessionId : sessions) {
            List<VisitEvent> events = visitEventRepository.findBySessionIdOrderByTimestampAsc(sessionId);
            if (events == null || events.isEmpty()) {
                continue;
            }
            events.sort(Comparator.comparing(VisitEvent::getTimestamp,
                    Comparator.nullsLast(Comparator.naturalOrder())));

            int targetIndex = -1;
            for (int i = 0; i < events.size(); i++) {
                if (events.get(i).getPageUrl().equals(pageUrl)) {
                    targetIndex = i;
                    break;
                }
            }

            if (targetIndex >= 0) {
                int depthAfterPage = events.size() - targetIndex - 1;
                totalDepth += depthAfterPage;
                sessionCount++;
            }
        }

        return sessionCount == 0 ? 0.0 : totalDepth / sessionCount;
    }

    public double calculateConversionRate(String entryPageUrl, String targetPageUrl) {
        List<String> entrySessions = visitEventRepository.findDistinctSessionIdsByPageUrl(entryPageUrl);
        if (entrySessions.isEmpty()) {
            return 0.0;
        }

        long entryCount = 0;
        long convertedCount = 0;

        for (String sessionId : entrySessions) {
            List<VisitEvent> events = visitEventRepository.findBySessionIdOrderByTimestampAsc(sessionId);
            if (events == null || events.isEmpty()) {
                continue;
            }
            events.sort(Comparator.comparing(VisitEvent::getTimestamp,
                    Comparator.nullsLast(Comparator.naturalOrder())));

            if (!events.get(0).getPageUrl().equals(entryPageUrl)) {
                continue;
            }

            entryCount++;

            Set<String> visitedPages = new HashSet<>();
            boolean reachedTarget = false;
            for (VisitEvent event : events) {
                visitedPages.add(event.getPageUrl());
                if (event.getPageUrl().equals(targetPageUrl)) {
                    reachedTarget = true;
                    break;
                }
            }

            if (reachedTarget) {
                convertedCount++;
            }
        }

        return entryCount == 0 ? 0.0 : (double) convertedCount / entryCount;
    }
}
