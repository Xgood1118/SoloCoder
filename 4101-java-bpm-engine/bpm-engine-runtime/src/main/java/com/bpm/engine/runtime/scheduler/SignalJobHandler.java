package com.bpm.engine.runtime.scheduler;

import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.signal.SignalService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;

@Component
@RequiredArgsConstructor
public class SignalJobHandler implements JobHandler {

    private final SignalService signalService;

    @Override
    public void execute(TimerJobEntity job, ExecutionContext context) {
        String signalId = job.getJobHandlerConfiguration();
        signalService.broadcastSignal(signalId, new HashMap<>());
    }
}
