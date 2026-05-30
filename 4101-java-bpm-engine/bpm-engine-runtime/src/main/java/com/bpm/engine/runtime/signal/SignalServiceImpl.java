package com.bpm.engine.runtime.signal;

import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class SignalServiceImpl implements SignalService {

    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    private final RabbitTemplate rabbitTemplate;

    private final Map<String, List<Subscription>> subscriptionRegistry = new ConcurrentHashMap<>();

    @Override
    public void broadcastSignal(String signalId, Map<String, Object> payload) {
        if (rabbitTemplate != null) {
            SignalEvent event = new SignalEvent(signalId, null, null, null, payload);
            rabbitTemplate.convertAndSend("bpm.signal.exchange", signalId, event);
        } else {
            deliverSignalLocally(signalId, payload);
        }
    }

    @Override
    public void subscribeSignal(String signalId, String processInstanceId, String executionId) {
        subscriptionRegistry.computeIfAbsent(signalId, k -> new ArrayList<>())
                .add(new Subscription(processInstanceId, executionId));
    }

    @Override
    public void unsubscribeSignal(String signalId, String processInstanceId) {
        List<Subscription> subscriptions = subscriptionRegistry.get(signalId);
        if (subscriptions != null) {
            subscriptions.removeIf(s -> s.processInstanceId.equals(processInstanceId));
            if (subscriptions.isEmpty()) {
                subscriptionRegistry.remove(signalId);
            }
        }
    }

    private void deliverSignalLocally(String signalId, Map<String, Object> payload) {
        List<Subscription> subscriptions = subscriptionRegistry.get(signalId);
        if (subscriptions == null || subscriptions.isEmpty()) {
            return;
        }

        for (Subscription subscription : new ArrayList<>(subscriptions)) {
            try {
                ExecutionEntity execution = executionRepository.findById(subscription.executionId).orElse(null);
                if (execution != null && execution.isActive()) {
                    SignalEvent event = new SignalEvent(
                            signalId, null,
                            subscription.processInstanceId,
                            subscription.executionId,
                            payload
                    );
                    runtimeService.signalExecution(execution.getId(), payload);
                }
            } catch (Exception e) {
                log.error("Failed to deliver signal {} to execution {}", signalId, subscription.executionId, e);
            }
        }
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class Subscription {
        private String processInstanceId;
        private String executionId;
    }
}
