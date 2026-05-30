package com.bpm.engine.runtime.scheduler;

import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TimerJobHandler implements JobHandler {

    private final RuntimeServiceImpl runtimeService;

    @Override
    public void execute(TimerJobEntity job, ExecutionContext context) {
        runtimeService.signalExecution(job.getExecutionId(), null);
    }
}
