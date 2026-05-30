package com.track.path;

import com.track.common.entity.VisitEvent;
import com.track.common.repository.VisitEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PathRestorationService {

    private final VisitEventRepository visitEventRepository;

    public List<PathNode> restorePath(String sessionId) {
        List<VisitEvent> events = visitEventRepository.findBySessionIdOrderByTimestampAsc(sessionId);
        if (events == null || events.isEmpty()) {
            log.warn("No visit events found for session: {}", sessionId);
            return new ArrayList<>();
        }

        events.sort(Comparator.comparing(VisitEvent::getTimestamp,
                Comparator.nullsLast(Comparator.naturalOrder())));

        List<PathNode> pathNodes = new ArrayList<>();

        for (int i = 0; i < events.size(); i++) {
            VisitEvent current = events.get(i);
            PathNode node = new PathNode();
            node.setPageUrl(current.getPageUrl());
            node.setEnterTime(current.getTimestamp());
            node.setReferrer(current.getReferrer());
            node.setOutOfOrder(false);

            if (i > 0) {
                VisitEvent previous = events.get(i - 1);
                LocalDateTime prevTime = previous.getTimestamp();
                LocalDateTime currTime = current.getTimestamp();

                if (prevTime != null && currTime != null && currTime.isBefore(prevTime)) {
                    node.setOutOfOrder(true);
                    log.warn("Out-of-order event detected for session {}: event at index {} has timestamp {} before previous {}",
                            sessionId, i, currTime, prevTime);
                }

                if (node.getReferrer() == null || node.getReferrer().isEmpty()) {
                    node.setReferrer(previous.getPageUrl());
                }

                if (previous.getTimestamp() != null && current.getTimestamp() != null) {
                    long seconds = Duration.between(previous.getTimestamp(), current.getTimestamp()).getSeconds();
                    if (seconds >= 0) {
                        pathNodes.get(i - 1).setDurationSeconds(seconds);
                    }
                }

                pathNodes.get(i - 1).setLeaveTime(current.getTimestamp());
                pathNodes.get(i - 1).setNextPageUrl(current.getPageUrl());
            }

            pathNodes.add(node);
        }

        return pathNodes;
    }
}
