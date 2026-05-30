package com.bpm.engine.runtime.boundary;

import com.bpm.engine.common.enums.BoundaryEventType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class BoundaryEventHandlerFactory {

    private final List<BoundaryEventHandler> handlerList;
    private Map<BoundaryEventType, BoundaryEventHandler> handlers;

    public BoundaryEventHandler getHandler(BoundaryEventType type) {
        if (handlers == null) {
            handlers = new EnumMap<>(BoundaryEventType.class);
            for (BoundaryEventHandler handler : handlerList) {
                if (handler instanceof TimerBoundaryHandler) {
                    handlers.put(BoundaryEventType.TIMER, handler);
                } else if (handler instanceof ErrorBoundaryHandler) {
                    handlers.put(BoundaryEventType.ERROR, handler);
                } else if (handler instanceof MessageBoundaryHandler) {
                    handlers.put(BoundaryEventType.MESSAGE, handler);
                }
            }
        }
        BoundaryEventHandler handler = handlers.get(type);
        if (handler == null) {
            throw new ProcessExecutionException("BOUNDARY_HANDLER_NOT_FOUND",
                    "No handler found for boundary event type: " + type);
        }
        return handler;
    }
}
