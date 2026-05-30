package com.featureflag.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "flag_change_event", indexes = {
        @Index(name = "idx_event_time", columnList = "created_at")
})
public class FlagChangeEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "flag_key", nullable = false, length = 100)
    private String flagKey;

    @Column(name = "application", nullable = false, length = 100)
    private String application;

    @Column(name = "change_type", nullable = false, length = 50)
    private String changeType;

    @Column(name = "version_number")
    private Long versionNumber;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
