package com.bpm.engine.runtime.scheduler;

import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.service.ExecutionContext;

public interface JobHandler {

    void execute(TimerJobEntity job, ExecutionContext context);
}
