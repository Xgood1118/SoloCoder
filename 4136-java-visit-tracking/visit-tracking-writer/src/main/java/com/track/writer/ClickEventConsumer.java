package com.track.writer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.track.common.entity.ClickEvent;
import com.track.common.enums.EventStatus;
import com.track.common.repository.ClickEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClickEventConsumer {

    private final ClickEventRepository clickEventRepository;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @KafkaListener(
            topics = "track-click-events",
            containerFactory = "concurrentKafkaListenerContainerFactory"
    )
    public void consume(List<ConsumerRecord<String, String>> records, Acknowledgment acknowledgment) {
        List<ClickEvent> events = new ArrayList<>();
        try {
            for (ConsumerRecord<String, String> record : records) {
                ClickEvent event = objectMapper.readValue(record.value(), ClickEvent.class);
                events.add(event);
            }
            List<ClickEvent> saved = clickEventRepository.saveAll(events);
            saved.forEach(e -> e.setStatus(EventStatus.PERSISTED));
            acknowledgment.acknowledge();
            log.info("Batch saved {} click events", saved.size());
        } catch (Exception e) {
            log.error("Failed to batch save click events, sending to DLT", e);
            for (ConsumerRecord<String, String> record : records) {
                try {
                    ClickEvent failedEvent = objectMapper.readValue(record.value(), ClickEvent.class);
                    failedEvent.setStatus(EventStatus.DISCARDED);
                    log.error("Failed click event: eventId={}, topic-partition-offset={}-{}-{}",
                            failedEvent.getEventId(), record.topic(), record.partition(), record.offset());
                } catch (Exception ex) {
                    log.error("Failed to deserialize click event from record at offset {}", record.offset(), ex);
                }
            }
            sendToDeadLetterTopic(records);
            acknowledgment.acknowledge();
        }
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
