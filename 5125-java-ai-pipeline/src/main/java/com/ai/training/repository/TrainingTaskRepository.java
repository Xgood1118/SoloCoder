package com.ai.training.repository;

import com.ai.training.entity.TrainingTask;
import com.ai.training.enums.ModelType;
import com.ai.training.enums.TrainingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrainingTaskRepository extends JpaRepository<TrainingTask, Long> {

    List<TrainingTask> findByStatus(TrainingStatus status);

    List<TrainingTask> findByModelType(ModelType modelType);

    List<TrainingTask> findBySubmitter(String submitter);

    @Query("SELECT t FROM TrainingTask t WHERE t.status = :status ORDER BY t.createdAt ASC")
    List<TrainingTask> findPendingTasksOrderByCreatedTime(@Param("status") TrainingStatus status);

    List<TrainingTask> findByStatusIn(List<TrainingStatus> statuses);
}
