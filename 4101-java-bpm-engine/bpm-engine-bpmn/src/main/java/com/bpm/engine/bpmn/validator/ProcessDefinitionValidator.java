package com.bpm.engine.bpmn.validator;

import com.bpm.engine.bpmn.model.BpmnProcess;

public interface ProcessDefinitionValidator {

    ValidationResult validate(BpmnProcess process);
}
