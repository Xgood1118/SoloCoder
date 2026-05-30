package com.bpm.engine.runtime.scheduler;

import com.bpm.engine.common.util.IdGenerator;
import com.bpm.engine.runtime.entity.ExecutionEntity;
import com.bpm.engine.runtime.entity.ProcessInstanceEntity;
import com.bpm.engine.runtime.entity.TimerJobEntity;
import com.bpm.engine.runtime.lock.DistributedLockService;
import com.bpm.engine.runtime.repository.ExecutionRepository;
import com.bpm.engine.runtime.repository.ProcessInstanceRepository;
import com.bpm.engine.runtime.repository.TimerJobRepository;
import com.bpm.engine.runtime.service.ExecutionContext;
import com.bpm.engine.runtime.service.RuntimeServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class JobScheduler {

    private final TimerJobRepository timerJobRepository;
    private final ProcessInstanceRepository processInstanceRepository;
    private final ExecutionRepository executionRepository;
    private final DistributedLockService distributedLockService;
    private final RuntimeServiceImpl runtimeService;

    private final Map<String, JobHandler> jobHandlerMap = new HashMap<>();

    public JobScheduler(TimerJobRepository timerJobRepository,
                        ProcessInstanceRepository processInstanceRepository,
                        ExecutionRepository executionRepository,
                        DistributedLockService distributedLockService,
                        RuntimeServiceImpl runtimeService,
                        List<JobHandler> jobHandlers) {
        this.timerJobRepository = timerJobRepository;
        this.processInstanceRepository = processInstanceRepository;
        this.executionRepository = executionRepository;
        this.distributedLockService = distributedLockService;
        this.runtimeService = runtimeService;
        for (JobHandler handler : jobHandlers) {
            if (handler instanceof TimerJobHandler) {
                jobHandlerMap.put("timer", handler);
                jobHandlerMap.put("timer-boundary", handler);
            } else if (handler instanceof MessageJobHandler) {
                jobHandlerMap.put("message", handler);
                jobHandlerMap.put("message-timeout", handler);
            } else if (handler instanceof SignalJobHandler) {
                jobHandlerMap.put("signal", handler);
            }
        }
    }

    @Scheduled(fixedDelay = 1000)
    @SchedulerLock(name = "bpmJobScheduler", lockAtLeastFor = "PT0S", lockAtMostFor = "PT30S")
    public void scheduleJobs() {
        List<TimerJobEntity> dueJobs = timerJobRepository.findByDuedateBeforeAndIsSuspended(LocalDateTime.now());
        for (TimerJobEntity job : dueJobs) {
            String lockKey = "job:" + job.getId();
            if (distributedLockService.tryLock(lockKey, Duration.ofSeconds(30))) {
                try {
                    executeJob(job);
                } catch (Exception e) {
                    log.error("Failed to execute job {}", job.getId(), e);
                    handleJobFailure(job, e);
                } finally {
                    distributedLockService.unlock(lockKey);
                }
            }
        }
    }

    private void executeJob(TimerJobEntity job) {
        job.setLockOwner(IdGenerator.generateId());
        job.setLockTime(LocalDateTime.now());
        timerJobRepository.save(job);

        ExecutionContext context = buildExecutionContext(job);
        JobHandler handler = jobHandlerMap.get(job.getJobHandlerType());
        if (handler != null) {
            handler.execute(job, context);
        }

        if (job.getRepeat() != null) {
            TimerJobEntity nextJob = new TimerJobEntity();
            nextJob.setProcessInstanceId(job.getProcessInstanceId());
            nextJob.setExecutionId(job.getExecutionId());
            nextJob.setActivityId(job.getActivityId());
            nextJob.setJobType(job.getJobType());
            nextJob.setJobHandlerType(job.getJobHandlerType());
            nextJob.setJobHandlerConfiguration(job.getJobHandlerConfiguration());
            nextJob.setDuedate(job.getRepeat());
            nextJob.setRepeat(job.getRepeat());
            nextJob.setRetries(3);
            nextJob.setSuspended(false);
            nextJob.setTenantId(job.getTenantId());
            timerJobRepository.save(nextJob);
        }

        timerJobRepository.deleteById(job.getId());
    }

    private void handleJobFailure(TimerJobEntity job, Exception e) {
        job.setRetries(job.getRetries() - 1);
        job.setExceptionMessage(e.getMessage());
        if (job.getRetries() <= 0) {
            job.setLockOwner(null);
            job.setLockTime(null);
            timerJobRepository.save(job);
        } else {
            job.setLockOwner(null);
            job.setLockTime(null);
            job.setDuedate(LocalDateTime.now().plusSeconds((4 - job.getRetries()) * 10L));
            timerJobRepository.save(job);
        }
    }

    private ExecutionContext buildExecutionContext(TimerJobEntity job) {
        ProcessInstanceEntity instance = processInstanceRepository.findById(job.getProcessInstanceId())
                .orElse(null);
        ExecutionEntity execution = executionRepository.findById(job.getExecutionId())
                .orElse(null);
        return new ExecutionContext(
                job.getProcessInstanceId(),
                instance != null ? instance.getProcessDefinitionId() : null,
                null,
                instance,
                execution,
                new HashMap<>(),
                job.getTenantId()
        );
    }
}
