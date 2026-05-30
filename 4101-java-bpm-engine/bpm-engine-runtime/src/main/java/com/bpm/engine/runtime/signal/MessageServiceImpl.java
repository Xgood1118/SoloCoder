package com.bpm.engine.runtime.signal;

import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.ProcessInstanceRepository;
import com.bpm.engine.runtime.repository.TimerJobRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {

    private final ProcessInstanceRepository processInstanceRepository;
    private final ExecutionRepository executionRepository;
    private final TimerJobRepository timerJobRepository;
    private final RuntimeServiceImpl runtimeService;

    private final RabbitTemplate rabbitTemplate;

    private final ConcurrentHashMap<String, MessageEvent> pendingMessages = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> deliveredMessageIds = new ConcurrentHashMap<>();
    private static final long IDEMPOTENCY_TTL_MS = 300_000;

    @Override
    public void sendMessage(String messageId, String targetProcessInstanceId, String targetExecutionId,
                            Map<String, Object> payload) {
        if (deliveredMessageIds.containsKey(messageId)) {
            return;
        }

        MessageEvent event = new MessageEvent(messageId, null, targetProcessInstanceId,
                targetExecutionId, payload);

        if (rabbitTemplate != null) {
            rabbitTemplate.convertAndSend("bpm.message.exchange", targetProcessInstanceId, event);
        } else {
            deliverMessageLocally(event);
        }

        deliveredMessageIds.put(messageId, System.currentTimeMillis());
        cleanupIdempotencyCache();
    }

    @Override
    public void correlateMessage(String messageName, String businessKey, Map<String, Object> payload) {
        List<ProcessInstanceEntity> instances = processInstanceRepository.findByBusinessKey(businessKey);
        for (ProcessInstanceEntity instance : instances) {
            String messageId = IdGenerator.generateId();
            List<ExecutionEntity> activeExecutions = executionRepository
                    .findByProcessInstanceIdAndIsActive(instance.getId(), true);
            if (!activeExecutions.isEmpty()) {
                ExecutionEntity target = activeExecutions.get(0);
                sendMessage(messageId, instance.getId(), target.getId(), payload);
            }
        }
    }

    @Override
    public void sendMessageWithTimeout(String messageId, String targetProcessInstanceId,
                                       String targetExecutionId, Map<String, Object> payload,
                                       LocalDateTime timeout, String timeoutAction) {
        sendMessage(messageId, targetProcessInstanceId, targetExecutionId, payload);

        TimerJobEntity timerJob = new TimerJobEntity();
        timerJob.setProcessInstanceId(targetProcessInstanceId);
        timerJob.setExecutionId(targetExecutionId);
        timerJob.setJobType("message");
        timerJob.setJobHandlerType("message-timeout");
        timerJob.setJobHandlerConfiguration(messageId + ":" + timeoutAction);
        timerJob.setDuedate(timeout);
        timerJob.setRetries(3);
        timerJob.setSuspended(false);
        timerJobRepository.save(timerJob);
    }

    private void deliverMessageLocally(MessageEvent event) {
        if (event.getTargetExecutionId() != null) {
            try {
                runtimeService.signalExecution(event.getTargetExecutionId(), event.getPayload());
            } catch (Exception e) {
                log.error("Failed to deliver message to execution {}", event.getTargetExecutionId(), e);
                pendingMessages.put(event.getMessageId(), event);
            }
        } else if (event.getTargetProcessInstanceId() != null) {
            List<ExecutionEntity> executions = executionRepository
                    .findByProcessInstanceIdAndIsActive(event.getTargetProcessInstanceId(), true);
            if (!executions.isEmpty()) {
                runtimeService.signalExecution(executions.get(0).getId(), event.getPayload());
            } else {
                pendingMessages.put(event.getMessageId(), event);
            }
        }
    }

    private void cleanupIdempotencyCache() {
        long now = System.currentTimeMillis();
        deliveredMessageIds.entrySet().removeIf(entry -> (now - entry.getValue()) > IDEMPOTENCY_TTL_MS);
    }
}
