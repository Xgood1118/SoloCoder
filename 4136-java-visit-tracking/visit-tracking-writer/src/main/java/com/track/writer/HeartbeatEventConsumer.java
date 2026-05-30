package com.track.writer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.track.common.entity.HeartbeatEvent;
import com.track.common.repository.HeartbeatEventRepository;
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
public class HeartbeatEventConsumer {

    private final HeartbeatEventRepository heartbeatEventRepository;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @KafkaListener(
            topics = "track-heartbeat-events",
            containerFactory = "concurrentKafkaListenerContainerFactory"
    )
    public void consume(List<ConsumerRecord<String, String>> records, Acknowledgment acknowledgment) {
        List<HeartbeatEvent> events = new ArrayList<>();
        try {
            for (ConsumerRecord<String, String> record : records) {
                HeartbeatEvent event = objectMapper.readValue(record.value(), HeartbeatEvent.class);
                events.add(event);
            }
            heartbeatEventRepository.saveAll(events);
            acknowledgment.acknowledge();
            log.info("Batch saved {} heartbeat events", events.size());
        } catch (Exception e) {
            log.error("Failed to batch save heartbeat events, sending to DLT", e);
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
