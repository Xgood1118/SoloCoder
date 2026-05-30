package com.featureflag.entity;

import com.featureflag.enums.FeatureFlagStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "gray_batch")
public class GrayBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feature_flag_id", nullable = false)
    private FeatureFlag featureFlag;

    @Column(name = "batch_name", nullable = false, length = 200)
    private String batchName;

    @Column(name = "batch_code", nullable = false, length = 100)
    private String batchCode;

    @Column(name = "batch_order")
    private Integer batchOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeatureFlagStatus status = FeatureFlagStatus.OFF;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "target_user_count")
    private Long targetUserCount;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "rule_id")
    private FeatureRule rule;
}
