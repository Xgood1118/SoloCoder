package com.bpm.engine.runtime.boundary;

import com.bpm.engine.bpmn.model.BoundaryEventConfig;
import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SequenceFlow;
import com.bpm.engine.bpmn.model.TimerConfig;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.TimerJobRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

@Component
public class TimerBoundaryHandler implements BoundaryEventHandler {

    private final TimerJobRepository timerJobRepository;
    private final ExecutionRepository executionRepository;
    private final RuntimeServiceImpl runtimeService;

    public TimerBoundaryHandler(TimerJobRepository timerJobRepository,
                           ExecutionRepository executionRepository,
                           @Lazy RuntimeServiceImpl runtimeService) {
        this.timerJobRepository = timerJobRepository;
        this.executionRepository = executionRepository;
        this.runtimeService = runtimeService;
    }

    @Override
    public void handle(ExecutionContext context, FlowNode boundaryNode, ExecutionEntity execution) {
        BoundaryEventConfig config = boundaryNode.getBoundaryEventConfig();
        if (config == null || config.getTimerConfig() == null) {
            throw new ProcessExecutionException("TIMER_CONFIG_MISSING",
                    "Timer config missing for boundary event: " + boundaryNode.getNodeId());
        }

        TimerConfig timerConfig = config.getTimerConfig();
        LocalDateTime duedate = calculateDuedate(timerConfig);

        TimerJobEntity timerJob = new TimerJobEntity();
        timerJob.setProcessInstanceId(context.getProcessInstanceId());
        timerJob.setExecutionId(execution.getId());
        timerJob.setActivityId(boundaryNode.getNodeId());
        timerJob.setJobType("timer");
        timerJob.setJobHandlerType("timer-boundary");
        timerJob.setJobHandlerConfiguration(boundaryNode.getNodeId());
        timerJob.setDuedate(duedate);
        timerJob.setRetries(3);
        timerJob.setSuspended(false);
        timerJob.setTenantId(context.getTenantId());

        if (timerConfig.getTimeCycle() != null) {
            timerJob.setRepeat(parseRepeatTime(timerConfig.getTimeCycle()));
        }

        timerJobRepository.save(timerJob);
    }

    public void onTimerFired(ExecutionContext context, FlowNode boundaryNode, TimerJobEntity timerJob) {
        BoundaryEventConfig config = boundaryNode.getBoundaryEventConfig();
        String attachedToRef = config.getAttachedToRef();

        if (config.isCancelActivity()) {
            List<ExecutionEntity> attachedExecutions = executionRepository.findByActivityId(attachedToRef);
            for (ExecutionEntity attached : attachedExecutions) {
                if (attached.getProcessInstanceId().equals(context.getProcessInstanceId())) {
                    attached.setActive(false);
                    executionRepository.save(attached);
                }
            }
        }

        SequenceFlow outgoingFlow = getOutgoingFlow(context, boundaryNode);
        if (outgoingFlow != null) {
            FlowNode targetNode = findNodeById(context, outgoingFlow.getTargetRef());
            runtimeService.executeNode(context, targetNode);
        }
    }

    private LocalDateTime calculateDuedate(TimerConfig timerConfig) {
        if (timerConfig.getTimeDate() != null) {
            try {
                return LocalDateTime.parse(timerConfig.getTimeDate());
            } catch (DateTimeParseException e) {
                throw new ProcessExecutionException("TIMER_DATE_INVALID",
                        "Invalid timeDate format: " + timerConfig.getTimeDate(), e);
            }
        }
        if (timerConfig.getTimeDuration() != null) {
            Duration duration = parseDuration(timerConfig.getTimeDuration());
            return LocalDateTime.now().plus(duration);
        }
        if (timerConfig.getTimeCycle() != null) {
            Duration duration = parseDuration(timerConfig.getTimeCycle());
            return LocalDateTime.now().plus(duration);
        }
        throw new ProcessExecutionException("TIMER_CONFIG_INVALID",
                "No valid timer configuration found");
    }

    private Duration parseDuration(String isoDuration) {
        try {
            return Duration.parse(isoDuration);
        } catch (DateTimeParseException e) {
            throw new ProcessExecutionException("TIMER_DURATION_INVALID",
                    "Invalid duration format: " + isoDuration, e);
        }
    }

    private LocalDateTime parseRepeatTime(String timeCycle) {
        try {
            Duration duration = Duration.parse(timeCycle);
            return LocalDateTime.now().plus(duration);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private SequenceFlow getOutgoingFlow(ExecutionContext context, FlowNode boundaryNode) {
        List<SequenceFlow> flows = context.getProcessDefinition().getSequenceFlows().stream()
                .filter(f -> boundaryNode.getOutgoingFlows().contains(f.getFlowId()))
                .toList();
        return flows.isEmpty() ? null : flows.get(0);
    }

    private FlowNode findNodeById(ExecutionContext context, String nodeId) {
        return context.getProcessDefinition().getFlowNodes().stream()
                .filter(n -> n.getNodeId().equals(nodeId))
                .findFirst()
                .orElseThrow(() -> new ProcessExecutionException("NODE_NOT_FOUND",
                        "Flow node not found: " + nodeId));
    }
}
