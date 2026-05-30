package com.track.common.entity;

import com.track.common.enums.EventStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "click_events")
public class ClickEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String eventId;

    @Column(nullable = false)
    private String sessionId;

    @Column
    private String fingerprintId;

    @Column
    private String userId;

    @Column(nullable = false)
    private String pageUrl;

    @Column
    private String elementId;

    @Column(nullable = false)
    private Double relativeX;

    @Column(nullable = false)
    private Double relativeY;

    @Column
    private Integer viewportWidth;

    @Column
    private Integer viewportHeight;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventStatus status;

    @Column
    private LocalDateTime timestamp;

    @Column
    private LocalDateTime serverTimestamp;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
