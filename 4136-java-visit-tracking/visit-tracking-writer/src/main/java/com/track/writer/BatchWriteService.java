package com.track.writer;

import com.track.common.entity.ClickEvent;
import com.track.common.entity.HeartbeatEvent;
import com.track.common.entity.VisitEvent;
import com.track.common.repository.ClickEventRepository;
import com.track.common.repository.HeartbeatEventRepository;
import com.track.common.repository.VisitEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BatchWriteService {

    private final VisitEventRepository visitEventRepository;
    private final HeartbeatEventRepository heartbeatEventRepository;
    private final ClickEventRepository clickEventRepository;

    @Transactional
    public List<VisitEvent> batchSaveVisitEvents(List<VisitEvent> events) {
        try {
            List<VisitEvent> saved = visitEventRepository.saveAll(events);
            log.info("Batch saved {} visit events", saved.size());
            return saved;
        } catch (Exception e) {
            log.error("Failed to batch save visit events", e);
            throw e;
        }
    }

    @Transactional
    public List<HeartbeatEvent> batchSaveHeartbeatEvents(List<HeartbeatEvent> events) {
        try {
            List<HeartbeatEvent> saved = heartbeatEventRepository.saveAll(events);
            log.info("Batch saved {} heartbeat events", saved.size());
            return saved;
        } catch (Exception e) {
            log.error("Failed to batch save heartbeat events", e);
            throw e;
        }
    }

    @Transactional
    public List<ClickEvent> batchSaveClickEvents(List<ClickEvent> events) {
        try {
            List<ClickEvent> saved = clickEventRepository.saveAll(events);
            log.info("Batch saved {} click events", saved.size());
            return saved;
        } catch (Exception e) {
            log.error("Failed to batch save click events", e);
            throw e;
        }
    }
}
