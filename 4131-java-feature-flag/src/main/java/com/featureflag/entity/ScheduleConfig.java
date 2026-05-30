package com.featureflag.entity;

import com.featureflag.enums.FeatureFlagStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "schedule_config")
public class ScheduleConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feature_flag_id", nullable = false)
    private FeatureFlag featureFlag;

    @Column(name = "schedule_name", length = 200)
    private String scheduleName;

    @Column(name = "cron_expression", length = 100)
    private String cronExpression;

    @Column(name = "target_status")
    @Enumerated(EnumType.STRING)
    private FeatureFlagStatus targetStatus;

    @Column(name = "effective_time")
    private LocalDateTime effectiveTime;

    @Column(name = "expire_time")
    private LocalDateTime expireTime;

    @Column(name = "enabled")
    private Boolean enabled = true;

    @Column(name = "executed")
    private Boolean executed = false;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
