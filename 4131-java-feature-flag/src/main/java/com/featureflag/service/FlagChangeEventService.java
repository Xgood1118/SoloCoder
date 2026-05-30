package com.featureflag.service;

import com.featureflag.entity.FlagChangeEvent;
import com.featureflag.repository.FlagChangeEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class FlagChangeEventService {

    private final FlagChangeEventRepository eventRepository;

    private final Map<String, List<SseEmitter>> sseEmitters = new ConcurrentHashMap<>();

    private final Map<String, List<LongPollingRequest>> longPollingRequests = new ConcurrentHashMap<>();

    public void publishChangeEvent(String flagKey, String application, String changeType, Long version) {
        FlagChangeEvent event = new FlagChangeEvent();
        event.setFlagKey(flagKey);
        event.setApplication(application);
        event.setChangeType(changeType);
        event.setVersionNumber(version);
        eventRepository.save(event);

        notifySseSubscribers(application, flagKey, changeType);
        notifyLongPollingSubscribers(application, flagKey);
    }

    public List<FlagChangeEvent> getEventsSince(String application, LocalDateTime since) {
        return eventRepository.findEventsSince(application, since);
    }

    public SseEmitter subscribeSse(String application) {
        SseEmitter emitter = new SseEmitter(300000L);
        sseEmitters.computeIfAbsent(application, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeSseEmitter(application, emitter));
        emitter.onTimeout(() -> removeSseEmitter(application, emitter));
        emitter.onError(e -> removeSseEmitter(application, emitter));

        return emitter;
    }

    public Object longPoll(String application, LocalDateTime lastPollTime) {
        List<FlagChangeEvent> events = getEventsSince(application, lastPollTime);
        if (!events.isEmpty()) {
            return events;
        }

        LongPollingRequest request = new LongPollingRequest();
        request.setApplication(application);
        request.setLastPollTime(lastPollTime);

        longPollingRequests.computeIfAbsent(application, k -> new CopyOnWriteArrayList<>()).add(request);

        synchronized (request) {
            try {
                request.wait(30000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        longPollingRequests.getOrDefault(application, List.of()).remove(request);

        return getEventsSince(application, lastPollTime);
    }

    private void notifySseSubscribers(String application, String flagKey, String changeType) {
        List<SseEmitter> emitters = sseEmitters.getOrDefault(application, List.of());
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("flag-change")
                        .data(Map.of("flagKey", flagKey, "changeType", changeType)));
            } catch (IOException e) {
                log.warn("Failed to send SSE event", e);
            }
        }
    }

    private void notifyLongPollingSubscribers(String application, String flagKey) {
        List<LongPollingRequest> requests = longPollingRequests.getOrDefault(application, List.of());
        for (LongPollingRequest request : requests) {
            synchronized (request) {
                request.notifyAll();
            }
        }
        longPollingRequests.remove(application);
    }

    private void removeSseEmitter(String application, SseEmitter emitter) {
        List<SseEmitter> emitters = sseEmitters.get(application);
        if (emitters != null) {
            emitters.remove(emitter);
        }
    }

    public static class LongPollingRequest {
        private String application;
        private LocalDateTime lastPollTime;

        public String getApplication() {
            return application;
        }

        public void setApplication(String application) {
            this.application = application;
        }

        public LocalDateTime getLastPollTime() {
            return lastPollTime;
        }

        public void setLastPollTime(LocalDateTime lastPollTime) {
            this.lastPollTime = lastPollTime;
        }
    }
}
