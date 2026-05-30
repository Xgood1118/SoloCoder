package com.bpm.engine.bpmn.service;

import com.bpm.engine.bpmn.model.BpmnProcess;
import com.bpm.engine.bpmn.parser.BpmnParser;
import com.bpm.engine.bpmn.repository.ProcessDefinitionEntity;
import com.bpm.engine.bpmn.repository.ProcessDefinitionRepository;
import com.bpm.engine.bpmn.validator.ProcessDefinitionValidator;
import com.bpm.engine.bpmn.validator.ValidationResult;
import com.bpm.engine.common.exception.ProcessDefinitionException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ProcessDefinitionServiceImpl implements ProcessDefinitionService {

    private final BpmnParser bpmnParser;
    private final ProcessDefinitionValidator processDefinitionValidator;
    private final ProcessDefinitionRepository processDefinitionRepository;

    private final ConcurrentHashMap<String, BpmnProcess> processCache = new ConcurrentHashMap<>();

    @Override
    @Transactional
    public ProcessDefinitionEntity deploy(String xml, String tenantId) {
        BpmnProcess process = bpmnParser.parse(xml);
        validateProcess(process);

        ProcessDefinitionEntity entity = buildEntity(process, xml, tenantId);
        resolveVersion(entity);

        entity = processDefinitionRepository.save(entity);
        processCache.put(entity.getId(), process);
        return entity;
    }

    @Override
    @Transactional
    public ProcessDefinitionEntity deploy(InputStream xmlStream, String tenantId) {
        BpmnProcess process = bpmnParser.parse(xmlStream);
        String xml = convertStreamToString(xmlStream);
        validateProcess(process);

        ProcessDefinitionEntity entity = buildEntity(process, xml, tenantId);
        resolveVersion(entity);

        entity = processDefinitionRepository.save(entity);
        processCache.put(entity.getId(), process);
        return entity;
    }

    @Override
    public BpmnProcess getProcessDefinition(String definitionId) {
        BpmnProcess cached = processCache.get(definitionId);
        if (cached != null) {
            return cached;
        }

        ProcessDefinitionEntity entity = processDefinitionRepository.findById(definitionId)
                .orElseThrow(() -> new ProcessDefinitionException("DEFINITION_NOT_FOUND",
                        "Process definition not found: " + definitionId));

        BpmnProcess process = bpmnParser.parse(entity.getXmlContent());
        processCache.put(definitionId, process);
        return process;
    }

    @Override
    public BpmnProcess getProcessDefinitionByKey(String processKey) {
        List<ProcessDefinitionEntity> entities = processDefinitionRepository.findByProcessKey(processKey);
        if (entities.isEmpty()) {
            throw new ProcessDefinitionException("DEFINITION_NOT_FOUND",
                    "Process definition not found for key: " + processKey);
        }

        ProcessDefinitionEntity entity = entities.get(0);
        return getProcessDefinition(entity.getId());
    }

    @Override
    public BpmnProcess getLatestProcessDefinition(String processKey) {
        Optional<ProcessDefinitionEntity> latest = processDefinitionRepository.findLatestVersionByProcessKey(processKey);
        if (latest.isEmpty()) {
            throw new ProcessDefinitionException("DEFINITION_NOT_FOUND",
                    "No process definition found for key: " + processKey);
        }

        return getProcessDefinition(latest.get().getId());
    }

    @Override
    @Transactional
    public void suspendDefinition(String definitionId) {
        ProcessDefinitionEntity entity = processDefinitionRepository.findById(definitionId)
                .orElseThrow(() -> new ProcessDefinitionException("DEFINITION_NOT_FOUND",
                        "Process definition not found: " + definitionId));

        entity.setIsSuspended(true);
        processDefinitionRepository.save(entity);
        processCache.remove(definitionId);
    }

    @Override
    @Transactional
    public void activateDefinition(String definitionId) {
        ProcessDefinitionEntity entity = processDefinitionRepository.findById(definitionId)
                .orElseThrow(() -> new ProcessDefinitionException("DEFINITION_NOT_FOUND",
                        "Process definition not found: " + definitionId));

        entity.setIsSuspended(false);
        processDefinitionRepository.save(entity);
        processCache.remove(definitionId);
    }

    @Override
    public List<ProcessDefinitionEntity> listDefinitions(String processKey) {
        if (processKey != null && !processKey.isEmpty()) {
            return processDefinitionRepository.findByProcessKey(processKey);
        }
        return processDefinitionRepository.findAll();
    }

    @Override
    @Transactional
    public void deleteDefinition(String definitionId, boolean physical) {
        if (physical) {
            processDefinitionRepository.deleteById(definitionId);
            processCache.remove(definitionId);
        } else {
            ProcessDefinitionEntity entity = processDefinitionRepository.findById(definitionId)
                    .orElseThrow(() -> new ProcessDefinitionException("DEFINITION_NOT_FOUND",
                            "Process definition not found: " + definitionId));

            entity.setDeleted(true);
            processDefinitionRepository.save(entity);
            processCache.remove(definitionId);
        }
    }

    private void validateProcess(BpmnProcess process) {
        ValidationResult result = processDefinitionValidator.validate(process);
        if (!result.isValid()) {
            throw new ProcessDefinitionException("VALIDATION_FAILED",
                    "Process definition validation failed: " + String.join("; ", result.getErrors()));
        }
    }

    private ProcessDefinitionEntity buildEntity(BpmnProcess process, String xml, String tenantId) {
        ProcessDefinitionEntity entity = new ProcessDefinitionEntity();
        entity.setProcessKey(process.getProcessKey());
        entity.setName(process.getName());
        entity.setCategory(process.getCategory());
        entity.setXmlContent(xml);
        entity.setIsExecutable(process.isExecutable());
        entity.setIsSuspended(false);
        entity.setTenantId(tenantId);
        return entity;
    }

    private void resolveVersion(ProcessDefinitionEntity entity) {
        Optional<ProcessDefinitionEntity> latest = processDefinitionRepository
                .findLatestVersionByProcessKey(entity.getProcessKey());

        if (latest.isPresent()) {
            entity.setVersion(latest.get().getVersion() + 1);
        } else {
            entity.setVersion(1);
        }
    }

    private String convertStreamToString(InputStream inputStream) {
        try {
            return new String(inputStream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }
}
