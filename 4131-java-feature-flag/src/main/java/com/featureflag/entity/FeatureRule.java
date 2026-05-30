package com.featureflag.entity;

import com.featureflag.enums.LogicOperator;
import com.featureflag.enums.RuleType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "feature_rule")
public class FeatureRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feature_flag_id", nullable = false)
    private FeatureFlag featureFlag;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false, length = 50)
    private RuleType ruleType;

    @Column(name = "rule_name", length = 200)
    private String ruleName;

    @Column(name = "percentage")
    private Integer percentage;

    @Enumerated(EnumType.STRING)
    @Column(name = "logic_operator", length = 10)
    private LogicOperator logicOperator = LogicOperator.AND;

    @Column(name = "priority")
    private Integer priority = 0;

    @Column(name = "enabled")
    private Boolean enabled = true;

    @OneToMany(mappedBy = "featureRule", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RuleCondition> conditions = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
