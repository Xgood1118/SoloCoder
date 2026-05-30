package com.featureflag.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "audit_log", indexes = {
        @Index(name = "idx_flag_key", columnList = "flag_key"),
        @Index(name = "idx_operator", columnList = "operator"),
        @Index(name = "idx_created_at", columnList = "created_at")
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "flag_key", length = 100)
    private String flagKey;

    @Column(name = "application", length = 100)
    private String application;

    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @Column(name = "operator", nullable = false, length = 100)
    private String operator;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "change_reason", length = 500)
    private String changeReason;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
