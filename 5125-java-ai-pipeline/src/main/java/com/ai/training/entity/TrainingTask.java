package com.ai.training.entity;

import com.ai.training.enums.ModelType;
import com.ai.training.enums.TrainingStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "training_task")
public class TrainingTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String taskName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ModelType modelType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TrainingStatus status;

    @Column(columnDefinition = "TEXT")
    private String trainingParams;

    @Column(length = 500)
    private String datasetSummary;

    @Column(length = 500)
    private String checkpointPath;

    private LocalDateTime lastCheckpointTime;

    @Column(length = 100)
    private String gpuNode;

    @Column(length = 100)
    private String submitter;

    @Column(length = 500)
    private String remark;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = TrainingStatus.PENDING_TRAINING;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
