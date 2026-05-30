package com.bpm.engine.runtime.control;

import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.common.exception.ProcessExecutionException;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.ProcessInstanceRepository;
import com.bpm.engine.runtime.repository.TimerJobRepository;
import com.bpm.engine.runtime.repository.VariableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProcessControlServiceImpl implements ProcessControlService {

    private final ProcessInstanceRepository processInstanceRepository;
    private final ExecutionRepository executionRepository;
    private final TimerJobRepository timerJobRepository;
    private final VariableRepository variableRepository;

    @Override
    @Transactional
    public void suspendProcessInstance(String processInstanceId) {
        ProcessInstanceEntity instance = processInstanceRepository.findById(processInstanceId)
                .orElseThrow(() -> new ProcessExecutionException("PROCESS_NOT_FOUND",
                        "Process instance not found: " + processInstanceId));

        instance.setStatus(ProcessStatus.SUSPENDED);
        instance.setSuspended(true);
        processInstanceRepository.save(instance);

        List<TimerJobEntity> timers = timerJobRepository.findByProcessInstanceId(processInstanceId);
        for (TimerJobEntity timer : timers) {
            timer.setSuspended(true);
            timerJobRepository.save(timer);
        }

        List<ExecutionEntity> executions = executionRepository.findByProcessInstanceIdAndIsActive(processInstanceId, true);
        for (ExecutionEntity execution : executions) {
            execution.setActive(false);
            executionRepository.save(execution);
        }
    }

    @Override
    @Transactional
    public void activateProcessInstance(String processInstanceId) {
        ProcessInstanceEntity instance = processInstanceRepository.findById(processInstanceId)
                .orElseThrow(() -> new ProcessExecutionException("PROCESS_NOT_FOUND",
                        "Process instance not found: " + processInstanceId));

        instance.setStatus(ProcessStatus.RUNNING);
        instance.setSuspended(false);
        processInstanceRepository.save(instance);

        List<TimerJobEntity> timers = timerJobRepository.findByProcessInstanceId(processInstanceId);
        for (TimerJobEntity timer : timers) {
            timer.setSuspended(false);
            timerJobRepository.save(timer);
        }

        List<ExecutionEntity> executions = executionRepository.findByProcessInstanceId(processInstanceId);
        for (ExecutionEntity execution : executions) {
            execution.setActive(true);
            executionRepository.save(execution);
        }
    }

    @Override
    @Transactional
    public void deleteProcessInstance(String processInstanceId, String deleteReason, boolean physicalDelete) {
        ProcessInstanceEntity instance = processInstanceRepository.findById(processInstanceId)
                .orElseThrow(() -> new ProcessExecutionException("PROCESS_NOT_FOUND",
                        "Process instance not found: " + processInstanceId));

        if (physicalDelete) {
            List<ExecutionEntity> childExecutions = executionRepository.findByProcessInstanceIdAndIsActive(processInstanceId, true);
            boolean hasActiveSubprocess = childExecutions.stream()
                    .anyMatch(e -> e.isScope() && e.getParentId() != null);
            if (hasActiveSubprocess) {
                throw new ProcessExecutionException("ACTIVE_SUBPROCESS_EXISTS",
                        "Cannot physically delete process instance with active subprocesses: " + processInstanceId);
            }

            variableRepository.findByProcessInstanceId(processInstanceId)
                    .forEach(v -> variableRepository.deleteById(v.getId()));
            timerJobRepository.findByProcessInstanceId(processInstanceId)
                    .forEach(t -> timerJobRepository.deleteById(t.getId()));
            executionRepository.findByProcessInstanceId(processInstanceId)
                    .forEach(e -> executionRepository.deleteById(e.getId()));
            processInstanceRepository.deleteById(processInstanceId);
        } else {
            instance.setStatus(ProcessStatus.DELETED);
            instance.setDeleted(true);
            instance.setDeleteReason(deleteReason);
            processInstanceRepository.save(instance);

            List<ExecutionEntity> executions = executionRepository.findByProcessInstanceIdAndIsActive(processInstanceId, true);
            for (ExecutionEntity execution : executions) {
                execution.setActive(false);
                executionRepository.save(execution);
            }
        }
    }
}
