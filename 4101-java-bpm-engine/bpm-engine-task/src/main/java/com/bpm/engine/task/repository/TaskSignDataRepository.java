package com.bpm.engine.task.repository;

import com.bpm.engine.task.entity.TaskSignDataEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskSignDataRepository extends JpaRepository<TaskSignDataEntity, String> {

    List<TaskSignDataEntity> findByTaskId(String taskId);

    List<TaskSignDataEntity> findByTaskIdAndSignType(String taskId, String signType);
}
