package com.bpm.engine.runtime.scheduler;

import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.signal.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;

@Component
@RequiredArgsConstructor
public class MessageJobHandler implements JobHandler {

    private final MessageService messageService;

    @Override
    public void execute(TimerJobEntity job, ExecutionContext context) {
        String config = job.getJobHandlerConfiguration();
        if (config != null && config.startsWith("message-timeout:")) {
            String action = config.substring("message-timeout:".length());
            if ("terminate".equals(action)) {
                context.getProcessInstance().setStatus(
                        com.bpm.engine.common.enums.ProcessStatus.TERMINATED
                );
            }
        } else {
            messageService.sendMessage(
                    job.getId(),
                    job.getProcessInstanceId(),
                    job.getExecutionId(),
                    new HashMap<>()
            );
        }
    }
}
