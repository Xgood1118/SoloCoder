package com.bpm.engine.history.archive;

import com.bpm.engine.common.enums.ArchiveStatus;
import com.bpm.engine.common.enums.ProcessStatus;
import com.bpm.engine.history.entity.HistoricActivityInstanceEntity;
import com.bpm.engine.history.entity.HistoricProcessInstanceEntity;
import com.bpm.engine.history.entity.HistoricTaskInstanceEntity;
import com.bpm.engine.history.entity.HistoricVariableInstanceEntity;
import com.bpm.engine.history.repository.HistoricActivityInstanceRepository;
import com.bpm.engine.history.repository.HistoricProcessInstanceRepository;
import com.bpm.engine.history.repository.HistoricTaskInstanceRepository;
import com.bpm.engine.history.repository.HistoricVariableInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class HistoryArchiveServiceImpl implements HistoryArchiveService {

    private final HistoricProcessInstanceRepository processInstanceRepository;
    private final HistoricActivityInstanceRepository activityInstanceRepository;
    private final HistoricTaskInstanceRepository taskInstanceRepository;
    private final HistoricVariableInstanceRepository variableInstanceRepository;

    @Override
    @Transactional
    public void archiveProcessInstances(LocalDateTime before, int batchSize) {
        Specification<HistoricProcessInstanceEntity> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("status"), ProcessStatus.COMPLETED),
                cb.lessThan(root.get("endTime"), before),
                cb.equal(root.get("archiveStatus"), ArchiveStatus.ACTIVE)
        );
        int archived = 0;
        while (true) {
            Page<HistoricProcessInstanceEntity> page = processInstanceRepository.findAll(spec,
                    PageRequest.of(0, batchSize));
            if (page.isEmpty()) {
                break;
            }
            List<HistoricProcessInstanceEntity> instances = page.getContent();
            for (HistoricProcessInstanceEntity instance : instances) {
                instance.setArchiveStatus(ArchiveStatus.ARCHIVED);
                archiveRelatedData(instance.getProcessInstanceId());
            }
            processInstanceRepository.saveAll(instances);
            archived += instances.size();
            if (instances.size() < batchSize) {
                break;
            }
        }
        log.info("Archived {} process instances before {}", archived, before);
    }

    @Override
    @Transactional
    public void archiveByProcessKey(String processKey, LocalDateTime before, int batchSize) {
        Specification<HistoricProcessInstanceEntity> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("processKey"), processKey),
                cb.equal(root.get("status"), ProcessStatus.COMPLETED),
                cb.lessThan(root.get("endTime"), before),
                cb.equal(root.get("archiveStatus"), ArchiveStatus.ACTIVE)
        );
        int archived = 0;
        while (true) {
            Page<HistoricProcessInstanceEntity> page = processInstanceRepository.findAll(spec,
                    PageRequest.of(0, batchSize));
            if (page.isEmpty()) {
                break;
            }
            List<HistoricProcessInstanceEntity> instances = page.getContent();
            for (HistoricProcessInstanceEntity instance : instances) {
                instance.setArchiveStatus(ArchiveStatus.ARCHIVED);
                archiveRelatedData(instance.getProcessInstanceId());
            }
            processInstanceRepository.saveAll(instances);
            archived += instances.size();
            if (instances.size() < batchSize) {
                break;
            }
        }
        log.info("Archived {} process instances for key {} before {}", archived, processKey, before);
    }

    @Override
    @Transactional
    public void cleanupArchivedData(LocalDateTime before, int batchSize) {
        Specification<HistoricProcessInstanceEntity> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("archiveStatus"), ArchiveStatus.ARCHIVED),
                cb.lessThan(root.get("updateTime"), before)
        );
        int deleted = 0;
        while (true) {
            Page<HistoricProcessInstanceEntity> page = processInstanceRepository.findAll(spec,
                    PageRequest.of(0, batchSize));
            if (page.isEmpty()) {
                break;
            }
            List<HistoricProcessInstanceEntity> instances = page.getContent();
            for (HistoricProcessInstanceEntity instance : instances) {
                String processInstanceId = instance.getProcessInstanceId();
                variableInstanceRepository.deleteAll(
                        variableInstanceRepository.findByProcessInstanceId(processInstanceId));
                taskInstanceRepository.deleteAll(
                        taskInstanceRepository.findByProcessInstanceId(processInstanceId));
                activityInstanceRepository.deleteAll(
                        activityInstanceRepository.findByProcessInstanceId(processInstanceId));
            }
            processInstanceRepository.deleteAll(instances);
            deleted += instances.size();
            if (instances.size() < batchSize) {
                break;
            }
        }
        log.info("Cleaned up {} archived process instances updated before {}", deleted, before);
    }

    private void archiveRelatedData(String processInstanceId) {
        activityInstanceRepository.findByProcessInstanceId(processInstanceId);
        taskInstanceRepository.findByProcessInstanceId(processInstanceId);
        variableInstanceRepository.findByProcessInstanceId(processInstanceId);
    }
}
