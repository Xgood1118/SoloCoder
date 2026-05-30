package com.bpm.engine.runtime.control;

public interface ProcessControlService {

    void suspendProcessInstance(String processInstanceId);

    void activateProcessInstance(String processInstanceId);

    void deleteProcessInstance(String processInstanceId, String deleteReason, boolean physicalDelete);
}
