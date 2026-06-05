package com.ai.training.entity;

import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "model_version")
public class ModelVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    @Column(nullable = false, length = 50)
    private String versionNumber;

    @Column(columnDefinition = "TEXT")
    private String trainingParams;

    @Column(length = 500)
    private String datasetSummary;

    @Column(precision = 10, scale = 6)
    private BigDecimal accuracy;

    @Column(precision = 10, scale = 6)
    private BigDecimal loss;

    @Column(precision = 10, scale = 6)
    private BigDecimal precision;

    @Column(precision = 10, scale = 6)
    private BigDecimal recall;

    @Column(precision = 10, scale = 6)
    private BigDecimal f1Score;

    @Column(length = 500)
    private String modelPath;

    private Long previousVersionId;

    @Column(length = 100)
    private String createdBy;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
