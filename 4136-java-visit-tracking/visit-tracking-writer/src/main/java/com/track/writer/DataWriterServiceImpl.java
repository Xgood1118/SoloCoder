package com.track.writer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.track.common.entity.ClickEvent;
import com.track.common.entity.HeartbeatEvent;
import com.track.common.entity.Session;
import com.track.common.entity.VisitEvent;
import com.track.common.enums.EventStatus;
import com.track.common.service.DataWriterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataWriterServiceImpl implements DataWriterService {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void writeVisit(VisitEvent event) {
        try {
            event.setStatus(EventStatus.VALIDATED);
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send("track-visit-events", event.getSessionId(), json);
            log.debug("Sent visit event to Kafka: eventId={}", event.getEventId());
        } catch (Exception e) {
            log.error("Failed to send visit event to Kafka: eventId={}", event.getEventId(), e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void writeHeartbeat(HeartbeatEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send("track-heartbeat-events", event.getSessionId(), json);
            log.debug("Sent heartbeat event to Kafka: eventId={}", event.getEventId());
        } catch (Exception e) {
            log.error("Failed to send heartbeat event to Kafka: eventId={}", event.getEventId(), e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void writeClick(ClickEvent event) {
        try {
            event.setStatus(EventStatus.VALIDATED);
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send("track-click-events", event.getSessionId(), json);
            log.debug("Sent click event to Kafka: eventId={}", event.getEventId());
        } catch (Exception e) {
            log.error("Failed to send click event to Kafka: eventId={}", event.getEventId(), e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void saveSession(Session session) {
        try {
            String json = objectMapper.writeValueAsString(session);
            kafkaTemplate.send("track-sessions", session.getSessionId(), json);
            log.debug("Sent session save to Kafka: sessionId={}", session.getSessionId());
        } catch (Exception e) {
            log.error("Failed to send session save to Kafka: sessionId={}", session.getSessionId(), e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void updateSession(Session session) {
        try {
            String json = objectMapper.writeValueAsString(session);
            kafkaTemplate.send("track-sessions", session.getSessionId(), json);
            log.debug("Sent session update to Kafka: sessionId={}", session.getSessionId());
        } catch (Exception e) {
            log.error("Failed to send session update to Kafka: sessionId={}", session.getSessionId(), e);
            throw new RuntimeException(e);
        }
    }
}
