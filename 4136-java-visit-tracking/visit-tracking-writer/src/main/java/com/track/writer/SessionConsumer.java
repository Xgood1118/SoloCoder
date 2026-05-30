package com.track.writer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.track.common.entity.Session;
import com.track.common.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SessionConsumer {

    private final SessionRepository sessionRepository;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @KafkaListener(
            topics = "track-sessions",
            containerFactory = "concurrentKafkaListenerContainerFactory"
    )
    public void consume(List<ConsumerRecord<String, String>> records, Acknowledgment acknowledgment) {
        try {
            for (ConsumerRecord<String, String> record : records) {
                Session session = objectMapper.readValue(record.value(), Session.class);
                sessionRepository.findBySessionId(session.getSessionId())
                        .ifPresentOrElse(
                                existing -> updateSession(existing, session),
                                () -> sessionRepository.save(session)
                        );
            }
            acknowledgment.acknowledge();
            log.info("Processed {} session records", records.size());
        } catch (Exception e) {
            log.error("Failed to process session records", e);
            sendToDeadLetterTopic(records);
            acknowledgment.acknowledge();
        }
    }

    private void updateSession(Session existing, Session incoming) {
        existing.setUserId(incoming.getUserId());
        existing.setFingerprintId(incoming.getFingerprintId());
        existing.setStatus(incoming.getStatus());
        existing.setCurrentPageUrl(incoming.getCurrentPageUrl());
        existing.setReferrer(incoming.getReferrer());
        existing.setLastActiveAt(incoming.getLastActiveAt());
        existing.setTotalDuration(incoming.getTotalDuration());
        existing.setPageViewCount(incoming.getPageViewCount());
        existing.setExpiredAt(incoming.getExpiredAt());
        sessionRepository.save(existing);
    }

    private void sendToDeadLetterTopic(List<ConsumerRecord<String, String>> records) {
        for (ConsumerRecord<String, String> record : records) {
            try {
                String dltTopic = record.topic() + "-dlt";
                kafkaTemplate.send(dltTopic, record.key(), record.value());
                log.error("Sent to DLT: topic={}, partition={}, offset={}, key={}",
                        record.topic(), record.partition(), record.offset(), record.key());
            } catch (Exception ex) {
                log.error("Failed to send to DLT: original topic={}, partition={}, offset={}",
                        record.topic(), record.partition(), record.offset(), ex);
            }
        }
    }
}
