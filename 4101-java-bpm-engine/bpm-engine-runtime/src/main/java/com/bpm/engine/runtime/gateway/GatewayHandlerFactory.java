package com.bpm.engine.runtime.gateway;

import com.bpm.engine.common.enums.GatewayType;
import com.bpm.engine.common.exception.ProcessExecutionException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GatewayHandlerFactory {

    private final List<GatewayHandler> handlerList;
    private Map<GatewayType, GatewayHandler> handlers;

    public GatewayHandler getHandler(GatewayType type) {
        if (handlers == null) {
            handlers = new EnumMap<>(GatewayType.class);
            for (GatewayHandler handler : handlerList) {
                if (handler instanceof ExclusiveGatewayHandler) {
                    handlers.put(GatewayType.EXCLUSIVE, handler);
                } else if (handler instanceof ParallelGatewayHandler) {
                    handlers.put(GatewayType.PARALLEL, handler);
                } else if (handler instanceof InclusiveGatewayHandler) {
                    handlers.put(GatewayType.INCLUSIVE, handler);
                } else if (handler instanceof EventGatewayHandler) {
                    handlers.put(GatewayType.EVENT, handler);
                }
            }
        }
        GatewayHandler handler = handlers.get(type);
        if (handler == null) {
            throw new ProcessExecutionException("GATEWAY_HANDLER_NOT_FOUND",
                    "No handler found for gateway type: " + type);
        }
        return handler;
    }
}
