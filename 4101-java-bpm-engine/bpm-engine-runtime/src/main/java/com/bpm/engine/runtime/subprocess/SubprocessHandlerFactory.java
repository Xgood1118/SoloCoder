package com.bpm.engine.runtime.subprocess;

import com.bpm.engine.bpmn.model.FlowNode;
import com.bpm.engine.bpmn.model.SubProcessConfig;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.service.ExecutionContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SubprocessHandlerFactory {

    private final EmbeddedSubprocessHandler embeddedSubprocessHandler;
    private final IndependentSubprocessHandler independentSubprocessHandler;
    private final CallActivityHandler callActivityHandler;

    public SubprocessHandler getHandler(FlowNode subprocessNode) {
        SubProcessConfig config = subprocessNode.getSubProcessConfig();
        if (config == null) {
            return embeddedSubprocessHandler;
        }

        if (config.getCalledElement() != null && !config.getCalledElement().isEmpty()) {
            return callActivityHandler;
        }

        if (config.isEmbedded()) {
            return embeddedSubprocessHandler;
        }

        return independentSubprocessHandler;
    }
}
