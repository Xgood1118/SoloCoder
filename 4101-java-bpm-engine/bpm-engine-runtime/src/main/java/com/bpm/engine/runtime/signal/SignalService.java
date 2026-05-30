package com.bpm.engine.runtime.signal;

import java.util.Map;

public interface SignalService {

    void broadcastSignal(String signalId, Map<String, Object> payload);

    void subscribeSignal(String signalId, String processInstanceId, String executionId);

    void unsubscribeSignal(String signalId, String processInstanceId);
}
