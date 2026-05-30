package com.track.common.dto;

import com.track.common.enums.SessionStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SessionDetailResponse {

    private String sessionId;
    private String userId;
    private String fingerprintId;
    private SessionStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime lastActiveAt;
    private Long totalDuration;
    private Integer pageViewCount;
    private List<PageVisitInfo> pages;
    private List<String> pathSequence;
}
