package com.featureflag.entity;

import com.featureflag.enums.ConditionOperator;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rule_condition")
public class RuleCondition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feature_rule_id", nullable = false)
    private FeatureRule featureRule;

    @Column(name = "attribute_name", nullable = false, length = 100)
    private String attributeName;

    @Enumerated(EnumType.STRING)
    @Column(name = "operator", nullable = false, length = 50)
    private ConditionOperator operator;

    @Column(name = "attribute_value", length = 1000)
    private String attributeValue;

    @Column(name = "value_type", length = 50)
    private String valueType = "STRING";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
