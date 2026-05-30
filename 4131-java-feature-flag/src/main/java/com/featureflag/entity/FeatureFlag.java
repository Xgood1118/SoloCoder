package com.featureflag.entity;

import com.featureflag.enums.Environment;
import com.featureflag.enums.FeatureFlagStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "feature_flag", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"flag_key", "application", "environment"})
})
public class FeatureFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "flag_key", nullable = false, length = 100)
    private String flagKey;

    @Column(name = "flag_name", nullable = false, length = 200)
    private String flagName;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeatureFlagStatus status = FeatureFlagStatus.OFF;

    @Column(name = "application", nullable = false, length = 100)
    private String application;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Environment environment = Environment.PRODUCTION;

    @Column(name = "group_name", length = 100)
    private String groupName;

    @Column(name = "default_value")
    private Boolean defaultValue = false;

    @Column(name = "cache_expire_seconds")
    private Integer cacheExpireSeconds = 300;

    @Column(name = "priority")
    private Integer priority = 0;

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

    @OneToMany(mappedBy = "featureFlag", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FeatureRule> rules = new ArrayList<>();

    @OneToMany(mappedBy = "featureFlag", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WhiteList> whiteLists = new ArrayList<>();

    @OneToMany(mappedBy = "featureFlag", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GrayBatch> grayBatches = new ArrayList<>();

    @OneToMany(mappedBy = "featureFlag", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ScheduleConfig> scheduleConfigs = new ArrayList<>();

    @Version
    private Long version;
}
