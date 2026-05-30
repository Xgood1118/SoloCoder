package com.bpm.engine.bpmn.service;

import com.bpm.engine.bpmn.model.BpmnProcess;
import com.bpm.engine.bpmn.repository.ProcessDefinitionEntity;

import java.io.InputStream;
import java.util.List;

public interface ProcessDefinitionService {

    ProcessDefinitionEntity deploy(String xml, String tenantId);

    ProcessDefinitionEntity deploy(InputStream xmlStream, String tenantId);

    BpmnProcess getProcessDefinition(String definitionId);

    BpmnProcess getProcessDefinitionByKey(String processKey);

    BpmnProcess getLatestProcessDefinition(String processKey);

    void suspendDefinition(String definitionId);

    void activateDefinition(String definitionId);

    List<ProcessDefinitionEntity> listDefinitions(String processKey);

    void deleteDefinition(String definitionId, boolean physical);
}
