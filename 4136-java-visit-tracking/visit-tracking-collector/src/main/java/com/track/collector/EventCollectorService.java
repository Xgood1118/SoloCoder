package com.track.collector;

import com.track.common.dto.ClickRequest;
import com.track.common.dto.HeartbeatRequest;
import com.track.common.dto.VisitRequest;
import com.track.common.entity.ClickEvent;
import com.track.common.entity.HeartbeatEvent;
import com.track.common.entity.VisitEvent;
import com.track.common.enums.EventStatus;
import com.track.common.service.DataWriterService;
import com.track.common.service.SessionManagerService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
@Slf4j
public class EventCollectorService {

    private final EventPreprocessor eventPreprocessor;
    private final DeduplicationService deduplicationService;
    private final DataWriterService dataWriterService;
    private final SessionManagerService sessionManagerService;

    private static final long ONE_HOUR_MILLIS = 3_600_000L;
    private static final long TWENTY_FOUR_HOURS_MILLIS = 86_400_000L;

    public EventCollectorService(EventPreprocessor eventPreprocessor,
                                 DeduplicationService deduplicationService,
                                 @Lazy DataWriterService dataWriterService,
                                 @Lazy SessionManagerService sessionManagerService) {
        this.eventPreprocessor = eventPreprocessor;
        this.deduplicationService = deduplicationService;
        this.dataWriterService = dataWriterService;
        this.sessionManagerService = sessionManagerService;
    }

    public void collectVisit(VisitRequest request) {
        if (!validateTimestamp(request.getTimestamp())) {
            throw new IllegalArgumentException("Timestamp is outside acceptable range");
        }

        String eventId = deduplicationService.generateEventId(request);
        if (deduplicationService.isDuplicate(eventId)) {
            log.warn("Duplicate visit event detected: eventId={}", eventId);
            return;
        }

        VisitEvent event = new VisitEvent();
        event.setEventId(eventId);
        event.setSessionId(request.getSessionId());
        event.setPageUrl(request.getPageUrl());
        event.setReferrer(request.getReferrer());
        event.setUserId(request.getUserId());
        event.setViewportSize(request.getViewportSize());
        event.setStatus(EventStatus.RECEIVED);
        event.setServerTimestamp(LocalDateTime.now(ZoneOffset.UTC));

        eventPreprocessor.preprocessVisit(event, request.getTimestamp());

        dataWriterService.writeVisit(event);
        sessionManagerService.updateSession(event);
    }

    public void collectHeartbeat(HeartbeatRequest request) {
        if (!validateTimestamp(request.getTimestamp())) {
            throw new IllegalArgumentException("Timestamp is outside acceptable range");
        }

        String eventId = deduplicationService.generateHeartbeatEventId(request);
        if (deduplicationService.isDuplicate(eventId)) {
            return;
        }

        HeartbeatEvent event = new HeartbeatEvent();
        event.setEventId(eventId);
        event.setSessionId(request.getSessionId());
        event.setPageUrl(request.getPageUrl());
        event.setServerTimestamp(LocalDateTime.now(ZoneOffset.UTC));

        eventPreprocessor.preprocessHeartbeat(event, request.getTimestamp());

        dataWriterService.writeHeartbeat(event);
        sessionManagerService.updateLastActive(request.getSessionId(), event.getServerTimestamp());
    }

    public void collectClick(ClickRequest request) {
        if (!validateTimestamp(request.getTimestamp())) {
            throw new IllegalArgumentException("Timestamp is outside acceptable range");
        }

        String eventId = UUID.randomUUID().toString();

        ClickEvent event = new ClickEvent();
        event.setEventId(eventId);
        event.setSessionId(request.getSessionId());
        event.setPageUrl(request.getPageUrl());
        event.setElementId(request.getElementId());
        event.setRelativeX(request.getRelativeX());
        event.setRelativeY(request.getRelativeY());
        event.setViewportWidth(request.getViewportWidth());
        event.setViewportHeight(request.getViewportHeight());
        event.setStatus(EventStatus.RECEIVED);
        event.setServerTimestamp(LocalDateTime.now(ZoneOffset.UTC));

        eventPreprocessor.preprocessClick(event, request.getTimestamp());

        dataWriterService.writeClick(event);
    }

    private boolean validateTimestamp(long epochMillis) {
        long now = System.currentTimeMillis();
        return (epochMillis >= now - TWENTY_FOUR_HOURS_MILLIS)
                && (epochMillis <= now + ONE_HOUR_MILLIS);
    }
}
