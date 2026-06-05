package com.ai.training.entity;

import com.ai.training.enums.TrainingStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rollback_record")
public class RollbackRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    @Column(nullable = false)
    private Long fromVersionId;

    @Column(nullable = false)
    private Long toVersionId;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private TrainingStatus targetStatus;

    @Column(columnDefinition = "TEXT")
    private String rollbackReason;

    @Column(length = 100)
    private String operator;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
